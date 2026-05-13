import type { FeedPostItem } from '../types/feed';
import { api } from './api';

const PAGE_SIZE = 20;

export async function fetchFeedPosts(token: string, skip: number): Promise<FeedPostItem[]> {
  const path = `/feed/posts?skip=${encodeURIComponent(String(skip))}&limit=${encodeURIComponent(String(PAGE_SIZE))}`;
  return api.get<FeedPostItem[]>(path, token);
}

export { PAGE_SIZE };
