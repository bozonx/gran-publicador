import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtOrApiTokenGuard } from '../../common/guards/jwt-or-api-token.guard.js';
import type { UnifiedAuthRequest } from '../../common/types/unified-auth-request.interface.js';
import { DashboardService } from './dashboard.service.js';

@Controller('dashboard')
@UseGuards(JwtOrApiTokenGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  public async getSummary(@Request() req: UnifiedAuthRequest) {
    return this.dashboardService.getSummary(req.user.userId);
  }
}
