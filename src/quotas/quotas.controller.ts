import { Controller, Get, Patch, Param, Query, Body } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { SystemRole } from '../common/enums/system-role.enum';
import { UpdateQuotaDto } from './dto/update-quota.dto';
import { QuotasService } from './quotas.service';

@Roles(SystemRole.ADMIN, SystemRole.HEAD_OF_DEPARTMENT)
@ApiTags('Quotas')
@ApiBearerAuth()
@Controller('quotas')
export class QuotasController {
  constructor(private readonly quotasService: QuotasService) {}

  @ApiOperation({ summary: 'List quota records' })
  @ApiQuery({ name: 'dot', required: false })
  @ApiQuery({ name: 'emailGV', required: false })
  @Get()
  findAll(@Query('dot') dot?: string, @Query('emailGV') emailGV?: string) {
    return this.quotasService.findAll(dot, emailGV);
  }

  @ApiOperation({ summary: 'Update quota value' })
  @ApiParam({ name: 'id' })
  @Patch(':id')
  updateQuota(@Param('id') id: string, @Body() payload: UpdateQuotaDto) {
    return this.quotasService.updateQuota(id, payload);
  }

  @ApiOperation({ summary: 'Approve or enable quota slot' })
  @ApiParam({ name: 'id' })
  @Patch(':id/approve')
  approveQuota(@Param('id') id: string) {
    return this.quotasService.approveQuota(id);
  }
}
