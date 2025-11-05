import Resolver from '@forge/resolver';
import api, { route } from '@forge/api';

const resolver = new Resolver();

// Get issue comments with chronological sorting
resolver.define('getIssueComments', async (req) => {
  const { issueKey, sortOrder = 'created' } = req.payload;
  
  // Input validation
  if (!issueKey || typeof issueKey !== 'string') {
    return {
      success: false,
      error: 'Invalid issue key provided',
      comments: [],
      total: 0
    };
  }
  
  try {
    // Fetch all comments with pagination support
    const allComments = [];
    let startAt = 0;
    const maxResults = 100;
    let total = 0;
    let hasMore = true;
    
    while (hasMore) {
      const url = route`/rest/api/3/issue/${issueKey}/comment?orderBy=${sortOrder}&expand=renderedBody&startAt=${startAt}&maxResults=${maxResults}`;
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
      if (allComments.length >= total || pageComments.length < maxResults) {
        hasMore = false;
      } else {
        startAt += maxResults;
      }
    }
    
    return {
      success: true,
      comments: allComments,
      total: total
    };
  } catch (error) {
    console.error('Error fetching comments:', error);
    return {
      success: false,
      error: error.message || 'Failed to fetch comments',
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
    return {
      success: false,
      error: error.message,
      issueKey: null,
      issueId: null
    };
  }
});

export const handler = resolver.getDefinitions();