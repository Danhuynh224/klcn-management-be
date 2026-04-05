import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole } from '../common/enums/system-role.enum';
import type { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Get current authenticated user' })
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getMe(user);
  }

  @Roles(SystemRole.ADMIN, SystemRole.HEAD_OF_DEPARTMENT)
  @ApiOperation({ summary: 'List users by role and keyword' })
  @ApiQuery({ name: 'role', required: false, enum: SystemRole })
  @ApiQuery({ name: 'keyword', required: false })
  @Get()
  findAll(
    @Query('role') role?: SystemRole,
    @Query('keyword') keyword?: string,
  ) {
    return this.usersService.findAll(role, keyword);
  }

  @ApiOperation({ summary: 'List lecturers with quota and field information' })
  @ApiQuery({ name: 'fieldName', required: false })
  @ApiQuery({ name: 'dot', required: false })
  @ApiQuery({ name: 'availableOnly', required: false, example: 'true' })
  @Roles(
    SystemRole.ADMIN,
    SystemRole.HEAD_OF_DEPARTMENT,
    SystemRole.LECTURER,
    SystemRole.STUDENT,
  )
  @Get('lecturers')
  findLecturers(
    @CurrentUser() user: AuthenticatedUser,
    @Query('fieldName') fieldName?: string,
    @Query('dot') dot?: string,
    @Query('availableOnly') availableOnly?: string,
  ) {
    return this.usersService.findLecturers(
      user,
      fieldName,
      dot,
      availableOnly === 'true',
    );
  }

  @Roles(SystemRole.ADMIN, SystemRole.HEAD_OF_DEPARTMENT, SystemRole.LECTURER)
  @ApiOperation({ summary: 'List students by keyword' })
  @ApiQuery({ name: 'keyword', required: false })
  @Get('students')
  findStudents(@Query('keyword') keyword?: string) {
    return this.usersService.findStudents(keyword);
  }
}
