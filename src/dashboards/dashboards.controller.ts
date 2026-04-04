import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole } from '../common/enums/system-role.enum';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { DashboardsService } from './dashboards.service';

@ApiTags('Dashboards')
@ApiBearerAuth()
@Controller('dashboards')
export class DashboardsController {
  constructor(private readonly dashboardsService: DashboardsService) {}

  @Roles(SystemRole.STUDENT)
  @ApiOperation({ summary: 'Get student dashboard data' })
  @Get('student')
  getStudentDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardsService.getStudentDashboard(user);
  }

  @Roles(SystemRole.LECTURER)
  @ApiOperation({ summary: 'Get lecturer dashboard data' })
  @Get('lecturer')
  getLecturerDashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.dashboardsService.getLecturerDashboard(user);
  }

  @Roles(SystemRole.ADMIN, SystemRole.HEAD_OF_DEPARTMENT)
  @ApiOperation({ summary: 'Get head of department dashboard data' })
  @Get('head')
  getHeadDashboard() {
    return this.dashboardsService.getHeadDashboard();
  }
}
