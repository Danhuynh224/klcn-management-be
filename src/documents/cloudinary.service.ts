import { HttpStatus, Injectable } from '@nestjs/common';
import { v2 as cloudinary, UploadApiErrorResponse, UploadApiResponse } from 'cloudinary';
import { extname } from 'node:path';
import { ErrorCode } from '../common/enums/error-code.enum';
import { AppException } from '../common/exceptions/app.exception';
import { createId } from '../common/utils/id.util';

@Injectable()
export class CloudinaryService {
  private isConfigured = false;

  constructor() {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (cloudName && apiKey && apiSecret) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.isConfigured = true;
    }
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadApiResponse> {
    if (!this.isConfigured) {
      console.error('Cloudinary is not configured', {
        hasCloudName: Boolean(process.env.CLOUDINARY_CLOUD_NAME),
        hasApiKey: Boolean(process.env.CLOUDINARY_API_KEY),
        hasApiSecret: Boolean(process.env.CLOUDINARY_API_SECRET),
      });

      throw new AppException(
        'Cloudinary chua duoc cau hinh',
        HttpStatus.INTERNAL_SERVER_ERROR,
        ErrorCode.DOCUMENT_NOT_ALLOWED,
      );
    }

    return new Promise<UploadApiResponse>((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: 'auto',
          public_id: createId('doc'),
          use_filename: false,
          unique_filename: true,
          filename_override: file.originalname,
          format: extname(file.originalname).replace('.', '') || undefined,
        },
        (error, result) => {
          if (error || !result) {
            const cloudinaryError = error as UploadApiErrorResponse | undefined;
            const upstreamMessage =
              typeof cloudinaryError?.message === 'string'
                ? cloudinaryError.message
                : 'Khong nhan duoc phan hoi hop le tu Cloudinary';

            console.error('Cloudinary upload failed', {
              message: upstreamMessage,
              httpCode: cloudinaryError?.http_code ?? null,
              name: cloudinaryError?.name ?? null,
              folder,
              originalName: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
            });

            reject(
              new AppException(
                `Upload Cloudinary that bai: ${upstreamMessage}`,
                HttpStatus.BAD_GATEWAY,
                ErrorCode.DOCUMENT_NOT_ALLOWED,
              ),
            );
            return;
          }

          resolve(result);
        },
      );

      upload.end(file.buffer);
    });
  }
}
