import { env } from '../../config/env';

export const buildPublicUrl = (resourcePath: string): string => {
  const baseUrl = env.publicBaseUrl.replace(/\/+$/, '');
  const normalizedPath = resourcePath.startsWith('/') ? resourcePath : `/${resourcePath}`;

  return `${baseUrl}${normalizedPath}`;
};

export const getThumbnailPublicPath = (videoId: string): string => {
  return `/media/videos/${videoId}/thumbnail`;
};

export const buildThumbnailUrl = (videoId: string): string => {
  return buildPublicUrl(getThumbnailPublicPath(videoId));
};
