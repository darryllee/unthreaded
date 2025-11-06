import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

// Get issue comments with chronological sorting
resolver.define('getIssueComments', async (req) => {
  const { issueKey, sortOrder = 'created', startAt = 0, maxResults = 100, loadAll = false } = req.payload;
  
  // Input validation
  if (!issueKey || typeof issueKey !== 'string') {
    return {
      success: false,
      error: 'Invalid issue key provided',
      comments: [],
      total: 0,
      hasMore: false
    };
  }
  
  try {
    const allComments = [];
    let currentStartAt = startAt;
    const pageSize = maxResults;
    let total = 0;
    let hasMore = false;
    
    // If loadAll is true, fetch all remaining comments
    if (loadAll) {
      let fetchingMore = true;
      while (fetchingMore) {
        const url = route`/rest/api/3/issue/${issueKey}/comment?orderBy=${sortOrder}&expand=renderedBody&startAt=${currentStartAt}&maxResults=${100}`;
        const response = await api.asApp().requestJira(url);
        
        // Check HTTP status
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`Jira API returned ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        const pageComments = data.comments || [];
        allComments.push(...pageComments);
        
        total = data.total || allComments.length;
        
        // Check if we've fetched all comments
        if (allComments.length >= total || pageComments.length < 100) {
          fetchingMore = false;
        } else {
          currentStartAt += 100;
        }
      }
    } else {
      // Fetch a single page
      const url = route`/rest/api/3/issue/${issueKey}/comment?orderBy=${sortOrder}&expand=renderedBody&startAt=${currentStartAt}&maxResults=${pageSize}`;
      const response = await api.asApp().requestJira(url);
      
      // Check HTTP status
      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Jira API returned ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      const pageComments = data.comments || [];
      allComments.push(...pageComments);
      
      total = data.total || 0;
      hasMore = allComments.length < total;
    }
    
    return {
      success: true,
      comments: allComments,
      total: total,
      hasMore: loadAll ? false : allComments.length < total
    };
  } catch (error) {
    console.error('Error fetching comments:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch comments',
      comments: [],
      total: 0,
      hasMore: false
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