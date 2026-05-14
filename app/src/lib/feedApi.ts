import type { FeedPostItem, FeedPostLikeState } from '../types/feed';
import { api } from './api';

const PAGE_SIZE = 20;

export async function fetchFeedPosts(token: string, skip: number): Promise<FeedPostItem[]> {
  const path = `/feed/posts?skip=${encodeURIComponent(String(skip))}&limit=${encodeURIComponent(String(PAGE_SIZE))}`;
  return api.get<FeedPostItem[]>(path, token);
}

export async function likeFeedPost(token: string, postId: string): Promise<FeedPostLikeState> {
  return api.post<FeedPostLikeState>(`/feed/posts/${encodeURIComponent(postId)}/like`, {}, token);
}

export async function unlikeFeedPost(token: string, postId: string): Promise<FeedPostLikeState> {
  return api.delete<FeedPostLikeState>(`/feed/posts/${encodeURIComponent(postId)}/like`, token);
}

export { PAGE_SIZE };
