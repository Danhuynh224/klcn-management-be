import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { RegistrationType } from '../common/enums/registration-type.enum';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole } from '../common/enums/system-role.enum';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ApproveRegistrationDto } from './dto/approve-registration.dto';
import { ChangeReviewerDto } from './dto/change-reviewer.dto';
import { ChangeSupervisorDto } from './dto/change-supervisor.dto';
import { CreateBcttRegistrationDto } from './dto/create-bctt-registration.dto';
import { CreateKltnRegistrationDto } from './dto/create-kltn-registration.dto';
import { QueryRegistrationsDto } from './dto/query-registrations.dto';
import { RejectRegistrationDto } from './dto/reject-registration.dto';
import { UpdateRegistrationStatusDto } from './dto/update-registration-status.dto';
import { RegistrationsService } from './registrations.service';

@ApiTags('Registrations')
@ApiBearerAuth()
@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly registrationsService: RegistrationsService) {}

  @Roles(SystemRole.STUDENT)
  @ApiOperation({ summary: 'Student creates a BCTT registration' })
  @Post('bctt')
  createBctt(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: CreateBcttRegistrationDto,
  ) {
    return this.registrationsService.createBctt(user, payload);
  }

  @Roles(SystemRole.STUDENT)
  @ApiOperation({ summary: 'Student creates a KLTN registration' })
  @Post('kltn')
  createKltn(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: CreateKltnRegistrationDto,
  ) {
    return this.registrationsService.createKltn(user, payload);
  }

  @ApiOperation({ summary: 'Get registrations related to current user' })
  @Get('me')
  getMine(@CurrentUser() user: AuthenticatedUser) {
    return this.registrationsService.getMine(user);
  }

  @ApiOperation({
    summary:
      'Get workflow status catalog for BCTT/KLTN so frontend can render labels and next steps',
  })
  @ApiQuery({ name: 'loai', required: false, enum: RegistrationType })
  @Get('status-catalog')
  getStatusCatalog(@Query('loai') loai?: RegistrationType) {
    return this.registrationsService.getStatusCatalog(loai);
  }

  @ApiOperation({
    summary: 'Get current BCTT/KLTN status of one student',
  })
  @ApiQuery({ name: 'loai', required: false, enum: RegistrationType })
  @ApiQuery({
    name: 'studentEmail',
    required: false,
    description:
      'Optional. Admin/head/lecturer can query another student by email.',
  })
  @Get('student-status')
  getStudentStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Query('loai') loai?: RegistrationType,
    @Query('studentEmail') studentEmail?: string,
  ) {
    return this.registrationsService.getStudentRegistrationStatus(
      user,
      loai,
      studentEmail,
    );
  }

  @ApiOperation({ summary: 'List registrations with filters' })
  @ApiQuery({ name: 'loai', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'dot', required: false })
  @ApiQuery({ name: 'emailGVHD', required: false })
  @ApiQuery({ name: 'emailGVPB', required: false })
  @ApiQuery({ name: 'committeeId', required: false })
  @ApiQuery({ name: 'roleView', required: false })
  @Get()
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: QueryRegistrationsDto,
  ) {
    return this.registrationsService.findAll(user, query);
  }

  @ApiOperation({ summary: 'Get registration detail by id' })
  @ApiParam({ name: 'id' })
  @Get(':id')
  findOneById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.registrationsService.findOneById(id, user);
  }

  @ApiOperation({
    summary: 'Get current workflow status of a registration by id',
  })
  @ApiParam({ name: 'id' })
  @Get(':id/status')
  getStatusById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registrationsService.getRegistrationStatusById(id, user);
  }

  @ApiOperation({
    summary: 'Get status history timeline of a registration by id',
  })
  @ApiParam({ name: 'id' })
  @Get(':id/status-history')
  getStatusHistoryById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.registrationsService.getRegistrationStatusHistory(id, user);
  }

  @Roles(SystemRole.LECTURER)
  @ApiOperation({ summary: 'Supervisor approves a registration' })
  @ApiParam({ name: 'id' })
  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: ApproveRegistrationDto,
  ) {
    return this.registrationsService.approve(id, user, payload);
  }

  @Roles(SystemRole.LECTURER)
  @ApiOperation({ summary: 'Supervisor rejects a registration' })
  @ApiParam({ name: 'id' })
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: RejectRegistrationDto,
  ) {
    return this.registrationsService.reject(id, user, payload);
  }

  @Roles(SystemRole.HEAD_OF_DEPARTMENT, SystemRole.ADMIN)
  @ApiOperation({ summary: 'Change supervisor for a registration' })
  @ApiParam({ name: 'id' })
  @Patch(':id/change-supervisor')
  changeSupervisor(
    @Param('id') id: string,
    @Body() payload: ChangeSupervisorDto,
  ) {
    return this.registrationsService.changeSupervisor(id, payload);
  }

  @Roles(SystemRole.HEAD_OF_DEPARTMENT, SystemRole.ADMIN)
  @ApiOperation({ summary: 'Assign or change reviewer for a registration' })
  @ApiParam({ name: 'id' })
  @Patch(':id/change-reviewer')
  changeReviewer(@Param('id') id: string, @Body() payload: ChangeReviewerDto) {
    return this.registrationsService.changeReviewer(id, payload);
  }

  @ApiOperation({ summary: 'Update business status of a registration' })
  @ApiParam({ name: 'id' })
  @Patch(':id/update-status')
  updateStatus(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: UpdateRegistrationStatusDto,
  ) {
    return this.registrationsService.updateStatus(id, user, payload);
  }
}
