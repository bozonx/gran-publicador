export class PostRequestDto {
  platform!: string;
  account?: string;
  body?: string;
  channelId?: string | number;
  auth?: Record<string, any>;
  type?: string;
  bodyFormat?: string;
  title?: string;
  description?: string;
  cover?: MediaInput;
  video?: MediaInput;
  audio?: MediaInput;
  document?: MediaInput;
  media?: MediaInput[];
  options?: Record<string, any>;
  disableNotification?: boolean;
  tags?: string[];
  scheduledAt?: string;
  postLanguage?: string;
  mode?: string;
  idempotencyKey?: string;
  maxBody?: number;
}

export class MediaInput {
  src!: string;
  hasSpoiler?: boolean;
  type?: string;
}

export class PostResponseDto {
  success!: boolean;
  data?: PostSuccessData;
  error?: PostErrorData;
}

export class PostSuccessData {
  postId!: string;
  url?: string;
  platform!: string;
  type!: string;
  publishedAt!: string;
  raw?: any;
  requestId!: string;
}

export class PostErrorData {
  code!: string;
  message!: string;
  details?: any;
  raw?: any;
  requestId?: string;
}

export class PreviewResponseDto {
  success!: boolean;
  data?: PreviewSuccessData | PreviewErrorData;
}

export class PreviewSuccessData {
  valid!: boolean;
  detectedType!: string;
  convertedBody!: string;
  warnings?: string[];
}

export class PreviewErrorData {
  valid!: boolean;
  errors?: string[];
}
