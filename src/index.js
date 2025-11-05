import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

// Get issue comments with chronological sorting
resolver.define('getIssueComments', async (req) => {
  const { issueKey, sortOrder = 'created' } = req.payload;
  
  // Input validation
  if (!issueKey || typeof issueKey !== 'string' || issueKey.trim() === '') {
    return {
      success: false,
      error: 'Invalid issueKey: must be a non-empty string',
      comments: [],
      total: 0
    };
  }
  
  try {
    // Fetch all comments with pagination (handles 100+ comments)
    let allComments = [];
    let startAt = 0;
    const maxResults = 100;
    let hasMore = true;
    
    while (hasMore) {
      const response = await api.asApp().requestJira(
        route`/rest/api/3/issue/${issueKey}/comment?orderBy=${sortOrder}&expand=renderedBody&startAt=${startAt}&maxResults=${maxResults}`
      );
      
      // HTTP status check
      if (!response.ok) {
        const errorText = await response.text();
        return {
          success: false,
          error: `HTTP ${response.status}: ${errorText || response.statusText}`,
          comments: [],
          total: 0
        };
      }
      
      const data = await response.json();
      const comments = data.comments || [];
      allComments = allComments.concat(comments);
      
      // Check if there are more comments to fetch
      hasMore = comments.length === maxResults && allComments.length < (data.total || 0);
      startAt += maxResults;
    }
    
    return {
      success: true,
      comments: allComments,
      total: allComments.length
    };
  } catch (error) {
    console.error('Error fetching comments:', error);
    const errorMessage = error.message || 'Unknown error occurred';
    const statusCode = error.statusCode || error.status || 'N/A';
    return {
      success: false,
      error: `Error (${statusCode}): ${errorMessage}`,
      comments: [],
      total: 0
    };
  }
});

// Get current issue context
resolver.define('getIssueContext', async (req) => {
  try {
    const context = req.context;
    return {
      success: true,
      issueKey: context?.extension?.issue?.key || null,
      issueId: context?.extension?.issue?.id || null
    };
  } catch (error) {
    console.error('Error getting issue context:', error);
    const errorMessage = error.message || 'Unknown error occurred';
    const statusCode = error.statusCode || error.status || 'N/A';
    return {
      success: false,
      error: `Error (${statusCode}): ${errorMessage}`,
      issueKey: null,
      issueId: null
    };
  }
});

export const handler = resolver.getDefinitions();