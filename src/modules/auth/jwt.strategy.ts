import { Injectable } from '@nestjs/common';
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

    super({
      ignoreExpiration: false,
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
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
    return {
      exp: payload.exp,
      iat: payload.iat,
      sub: payload.sub,
      telegramId: payload.telegramId,
      telegramUsername: payload.telegramUsername,
    };
  }
}
