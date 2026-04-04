import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FieldsService } from './fields.service';

@ApiTags('Fields')
@ApiBearerAuth()
@Controller('fields')
export class FieldsController {
  constructor(private readonly fieldsService: FieldsService) {}

  @ApiOperation({ summary: 'List lecturer fields' })
  @ApiQuery({ name: 'emailGV', required: false })
  @Get()
  findAll(@Query('emailGV') emailGV?: string) {
    return this.fieldsService.findAll(emailGV);
  }

  @ApiOperation({ summary: 'List suggested topics' })
  @ApiQuery({ name: 'fieldName', required: false })
  @Get('suggestions')
  getSuggestions(@Query('fieldName') fieldName?: string) {
    return this.fieldsService.getSuggestions(fieldName);
  }
}
