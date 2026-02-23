import { createHash, randomUUID } from 'node:crypto';

import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import type { User } from '../../generated/prisma/index.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type JwtTokenType = 'access' | 'refresh';

export interface IssueTokensInput {
  userId: string;
  telegramId?: string;
  telegramUsername?: string | null;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  public async createSessionAndIssueTokens(input: IssueTokensInput): Promise<IssuedTokens> {
    const sessionId = randomUUID();

    const tokens = await this.issueTokens({ ...input, sessionId });

    await this.prisma.userSession.create({
      data: {
        id: sessionId,
        userId: input.userId,
        hashedRefreshToken: this.hashRefreshToken(tokens.refreshToken),
        expiresAt: this.getRefreshTokenExpiresAt(),
      },
    });

    return tokens;
  }

  public async refreshSession(refreshToken: string): Promise<{ user: User; tokens: IssuedTokens }> {
    const payload = await this.verifyRefreshToken(refreshToken);

    const sessionId = payload.jti;
    if (!sessionId) {
      throw new ForbiddenException('Access Denied (Invalid refresh token)');
    }

    const session = await this.prisma.userSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.userId !== payload.sub) {
      throw new ForbiddenException('Access Denied (Invalid refresh token)');
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      await this.prisma.userSession.delete({ where: { id: session.id } });
      throw new ForbiddenException('Access Denied (Refresh token expired)');
    }

    if (session.user.deletedAt) {
      throw new ForbiddenException('Access Denied (Invalid user or account deleted)');
    }

    const refreshTokenHash = this.hashRefreshToken(refreshToken);
    if (session.hashedRefreshToken !== refreshTokenHash) {
      throw new ForbiddenException('Access Denied (Invalid refresh token)');
    }

    const tokens = await this.issueTokens({
      userId: session.user.id,
      telegramId: session.user.telegramId?.toString(),
      telegramUsername: session.user.telegramUsername,
      sessionId: session.id,
    });

    await this.prisma.userSession.update({
      where: { id: session.id },
      data: {
        hashedRefreshToken: this.hashRefreshToken(tokens.refreshToken),
        expiresAt: this.getRefreshTokenExpiresAt(),
      },
    });

    return { user: session.user, tokens };
  }

  public async logout(userId: string, refreshToken: string): Promise<void> {
    const payload = await this.verifyRefreshToken(refreshToken);

    if (payload.sub !== userId) {
      throw new ForbiddenException('Access Denied');
    }

    const sessionId = payload.jti;
    if (!sessionId) {
      throw new ForbiddenException('Access Denied');
    }

    await this.prisma.userSession.deleteMany({
      where: {
        id: sessionId,
        userId,
      },
    });
  }

  private async issueTokens(input: IssueTokensInput & { sessionId: string }): Promise<IssuedTokens> {
    const secret = this.configService.get<string>('app.jwtSecret');
    if (!secret) {
      throw new UnauthorizedException('JWT secret is not configured');
    }

    const accessPayload = {
      sub: input.userId,
      tokenType: 'access' as const,
      telegramId: input.telegramId,
      telegramUsername: input.telegramUsername,
    };

    const refreshPayload = {
      sub: input.userId,
      tokenType: 'refresh' as const,
      telegramId: input.telegramId,
      telegramUsername: input.telegramUsername,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret,
        expiresIn: '15m',
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret,
        expiresIn: '7d',
        jwtid: input.sessionId,
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(refreshToken: string): Promise<{ sub: string; tokenType?: JwtTokenType; jti?: string }> {
    const secret = this.configService.get<string>('app.jwtSecret');
    if (!secret) {
      throw new UnauthorizedException('JWT secret is not configured');
    }

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, { secret });
    } catch {
      throw new ForbiddenException('Access Denied (Invalid refresh token)');
    }

    if (!payload?.sub || typeof payload.sub !== 'string') {
      throw new ForbiddenException('Access Denied (Invalid refresh token payload)');
    }

    if (payload.tokenType && payload.tokenType !== 'refresh') {
      throw new ForbiddenException('Access Denied (Invalid refresh token)');
    }

    return { sub: payload.sub, tokenType: payload.tokenType, jti: payload.jti };
  }

  private hashRefreshToken(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }

  private getRefreshTokenExpiresAt(): Date {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    return expiresAt;
  }
}
