import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

import { JWT_STRATEGY } from '../constants/auth.constants.js';

/**
 * Guard that implements JWT authentication.
 * Extends the default Passport AuthGuard with the 'jwt' strategy.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard(JWT_STRATEGY) {}
