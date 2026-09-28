export interface SocialSignal {
  platform: string;
  topic: string;
  artist?: string;
  mentions?: number;
  engagement?: number;
  velocity?: number;
  region?: string;
  detectedAt: Date;
}
