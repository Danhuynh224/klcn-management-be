import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  it('should return health status', () => {
    expect(appController.getHealth()).toEqual({
      data: {
        service: 'klcn-management-be',
        status: 'ok',
      },
      message: 'KLCN backend is running',
    });
  });
});
