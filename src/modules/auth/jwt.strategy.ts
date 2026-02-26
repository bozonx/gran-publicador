import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { JwtPayload } from '../../common/types/jwt-payload.interface.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  /**
   * Initialize the strategy.
   * Configures the JWT extraction from the Bearer token and sets the secret key.
   */
  constructor(private readonly configService: ConfigService) {
    const secret = configService.get<string>('app.jwtSecret');
    if (!secret) {
      throw new Error('JWT secret is not configured');
    }

    const cookieExtractor = (req: any): string | null => {
      const token = req?.cookies?.access_token;
      return typeof token === 'string' && token.length > 0 ? token : null;
    };

    super({
      ignoreExpiration: false,
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      secretOrKey: secret,
    });
  }

  /**
   * Validate the JWT payload.
   * This method is called by Passport after successfully verifying the token signature.
   * It transforms the payload into a structured object for the request.
   *
   * @param payload - The decoded JWT payload.
   * @returns A partial user object (JwtPayload) attached to the request.
   */
  public validate(payload: any): JwtPayload {
    if (payload?.tokenType && payload.tokenType !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    return {
      sub: payload.sub,
      tokenType: payload.tokenType,
      jti: payload.jti,
      id: payload.sub,
      userId: payload.sub,
      exp: payload.exp,
      iat: payload.iat,
      telegramId: payload.telegramId,
      telegramUsername: payload.telegramUsername,
    };
  }
}
