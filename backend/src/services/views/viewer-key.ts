import crypto from 'node:crypto';
import { Request } from 'express';

export type ViewerRequestMetadata = {
  ip: string;
  userAgent: string;
};

export type ViewerMetadataExtractor = (req: Request) => ViewerRequestMetadata;

export type ViewerKeyHasher = (value: string) => string;

const normalize = (value: string | null | undefined, fallback: string): string => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
};

export const defaultViewerMetadataExtractor: ViewerMetadataExtractor = (req) => {
  return {
    ip: normalize(req.ip, 'unknown-ip'),
    userAgent: normalize(req.get('user-agent'), 'unknown-user-agent'),
  };
};

export const sha256Hex: ViewerKeyHasher = (value) => {
  return crypto.createHash('sha256').update(value).digest('hex');
};

export const buildAnonymousViewerKey = (
  metadata: ViewerRequestMetadata,
  hasher: ViewerKeyHasher = sha256Hex,
): string => {
  const ip = normalize(metadata.ip, 'unknown-ip');
  const userAgent = normalize(metadata.userAgent, 'unknown-user-agent');

  return hasher(`${ip}|${userAgent}`);
};

type ViewerKeyResolverOptions = {
  metadataExtractor?: ViewerMetadataExtractor;
  hasher?: ViewerKeyHasher;
};

export const createViewerKeyResolver = (options: ViewerKeyResolverOptions = {}) => {
  const metadataExtractor = options.metadataExtractor ?? defaultViewerMetadataExtractor;
  const hasher = options.hasher ?? sha256Hex;

  return (req: Request): string => {
    if (req.user) {
      return req.user.id;
    }

    const metadata = metadataExtractor(req);
    return buildAnonymousViewerKey(metadata, hasher);
  };
};
