import React, { useReducer, useEffect, useMemo } from 'react';
import ForgeReconciler, { 
  Text, 
  Button, 
  Stack, 
  Strong, 
  Spinner, 
  EmptyState,
  Inline,
  Box,
  User,
  ButtonGroup,
  SectionMessage,
  Textfield,
  Select,
  DatePicker,
  Heading,
  AdfRenderer,
  xcss
} from '@forge/react';
import { invoke } from '@forge/bridge';

const cardStyle = xcss({
  backgroundColor: 'elevation.surface',
  padding: 'space.200',
  borderColor: 'color.border',
  borderWidth: 'border.width',
  borderStyle: 'solid',
  borderRadius: 'border.radius',
  marginBottom: 'space.100'
});

// Action types
const ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_LOADING_MORE: 'SET_LOADING_MORE',
  SET_COMMENTS: 'SET_COMMENTS',
  ADD_COMMENTS: 'ADD_COMMENTS',
  SET_ERROR: 'SET_ERROR',
  SET_ISSUE_KEY: 'SET_ISSUE_KEY',
  SET_SORT_ORDER: 'SET_SORT_ORDER',
  SET_SEARCH_INPUT: 'SET_SEARCH_INPUT',
  SET_SEARCH_TERM: 'SET_SEARCH_TERM',
  SET_AUTHOR_FILTER: 'SET_AUTHOR_FILTER',
  SET_DATE_FROM: 'SET_DATE_FROM',
  SET_DATE_TO: 'SET_DATE_TO',
  TOGGLE_STATS: 'TOGGLE_STATS',
  TOGGLE_FILTERS: 'TOGGLE_FILTERS',
  CLEAR_FILTERS: 'CLEAR_FILTERS'
};

// Initial state
const initialState = {
  // Data state
  comments: [],
  issueKey: null,
  total: 0,
  hasMore: false,
  hasLoadedMore: false,
  
  // Loading state
  loading: true,
  loadingMore: false,
  error: null,
  
  // Sort state
  sortOrder: 'created',
  
  // Filter state
  searchTermInput: '',
  searchTerm: '',
  selectedAuthor: 'all',
  dateFrom: null,
  dateTo: null,
  
  // UI state
  showStats: false,
  showFilters: false
};

// Reducer function
const commentsReducer = (state, action) => {
  switch (action.type) {
    case ACTIONS.SET_LOADING:
      return { ...state, loading: action.payload };
      
    case ACTIONS.SET_LOADING_MORE:
      return { ...state, loadingMore: action.payload };
      
    case ACTIONS.SET_COMMENTS:
      return {
        ...state,
        comments: action.payload.comments,
        total: action.payload.total,
        hasMore: action.payload.hasMore,
        loading: false,
        error: null,
        hasLoadedMore: false
      };
      
    case ACTIONS.ADD_COMMENTS:
      return {
        ...state,
        comments: [...state.comments, ...action.payload.comments],
        total: action.payload.total,
        hasMore: action.payload.hasMore,
        loadingMore: false,
        hasLoadedMore: true,
        error: null
      };
      
    case ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        loading: false,
        loadingMore: false,
        comments: action.payload === 'Unable to get issue context' || action.payload === 'Failed to load issue context' ? [] : state.comments,
        hasMore: action.payload.includes('Failed to load') ? false : state.hasMore
      };
      
    case ACTIONS.SET_ISSUE_KEY:
      return { ...state, issueKey: action.payload };
      
    case ACTIONS.SET_SORT_ORDER:
      return { ...state, sortOrder: action.payload };
      
    case ACTIONS.SET_SEARCH_INPUT:
      return { ...state, searchTermInput: action.payload };
      
    case ACTIONS.SET_SEARCH_TERM:
      return { ...state, searchTerm: action.payload };
      
    case ACTIONS.SET_AUTHOR_FILTER:
      return { ...state, selectedAuthor: action.payload };
      
    case ACTIONS.SET_DATE_FROM:
      return { ...state, dateFrom: action.payload };
      
    case ACTIONS.SET_DATE_TO:
      return { ...state, dateTo: action.payload };
      
    case ACTIONS.TOGGLE_STATS:
      return { ...state, showStats: !state.showStats };
      
    case ACTIONS.TOGGLE_FILTERS:
      return { ...state, showFilters: !state.showFilters };
      
    case ACTIONS.CLEAR_FILTERS:
      return {
        ...state,
        searchTermInput: '',
        searchTerm: '',
        selectedAuthor: 'all',
        dateFrom: null,
        dateTo: null
      };
      
    default:
      return state;
  }
};

const CommentsList = () => {
  const [state, dispatch] = useReducer(commentsReducer, initialState);
  
  // Destructure state for easier access
  const {
    comments, loading, loadingMore, sortOrder, issueKey, error, total, hasMore, hasLoadedMore,
    searchTermInput, searchTerm, selectedAuthor, dateFrom, dateTo,
    showStats, showFilters
  } = state;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch({ type: ACTIONS.SET_SEARCH_TERM, payload: searchTermInput.trim() });
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTermInput]);


  // Get issue context on component mount
  useEffect(() => {
    const getIssueContext = async () => {
      try {
        const contextResult = await invoke('getIssueContext');
        if (contextResult.success && contextResult.issueKey) {
          dispatch({ type: ACTIONS.SET_ISSUE_KEY, payload: contextResult.issueKey });
        } else {
          dispatch({ type: ACTIONS.SET_ERROR, payload: 'Unable to get issue context' });
        }
      } catch (err) {
        console.error('Failed to get issue context:', err);
        dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to load issue context' });
      }
    };
    getIssueContext();
  }, []);

  // Fetch initial comments when issue key or sort order changes
  useEffect(() => {
    if (!issueKey) return;
    
    const fetchComments = async () => {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      try {
        const result = await invoke('getIssueComments', { 
          issueKey, 
          sortOrder,
          startAt: 0,
          maxResults: 20
        });
        
        if (result.success) {
          dispatch({ 
            type: ACTIONS.SET_COMMENTS, 
            payload: {
              comments: result.comments || [],
              total: result.total || 0,
              hasMore: result.hasMore || false
            }
          });
        } else {
          dispatch({ type: ACTIONS.SET_ERROR, payload: result.error || 'Failed to load comments' });
        }
      } catch (err) {
        console.error('Failed to fetch comments:', err);
        dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to load comments' });
      }
    };

    fetchComments();
  }, [issueKey, sortOrder]);

  // Load more comments
  const loadMoreComments = async (loadAll = false) => {
    if (loadingMore) return;
    
    dispatch({ type: ACTIONS.SET_LOADING_MORE, payload: true });
    try {
      const requestParams = {
        issueKey,
        sortOrder,
        startAt: comments.length,
        loadAll: loadAll
      };
      
      if (!loadAll) {
        requestParams.maxResults = 100;
      }
      
      console.log('Request params:', requestParams);
      const result = await invoke('getIssueComments', requestParams);
      
      if (result.success) {
        dispatch({
          type: ACTIONS.ADD_COMMENTS,
          payload: {
            comments: result.comments || [],
            total: result.total || total,
            hasMore: result.hasMore || false
          }
        });
      } else {
        dispatch({ type: ACTIONS.SET_ERROR, payload: result.error || 'Failed to load more comments' });
      }
    } catch (err) {
      console.error('Failed to load more comments:', err);
      dispatch({ type: ACTIONS.SET_ERROR, payload: 'Failed to load more comments' });
    }
  };

  const toggleSortOrder = () => {
    dispatch({ 
      type: ACTIONS.SET_SORT_ORDER, 
      payload: sortOrder === 'created' ? '-created' : 'created' 
    });
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(date);
    } catch (e) {
      return dateString;
    }
  };

  const extractTextFromAdf = (adfContent) => {
    if (!adfContent || !adfContent.content) return '';
    
    let text = '';
    const extractText = (node) => {
      if (node.type === 'text') {
        text += node.text || '';
      } else if (node.type === 'hardBreak') {
        text += '\n';
      } else if (node.type === 'paragraph') {
        if (node.content) {
          node.content.forEach(extractText);
          text += '\n\n';
        }
      } else if (node.content) {
        node.content.forEach(extractText);
      }
    };
    
    adfContent.content.forEach(extractText);
    return text.trim();
  };


  // Get unique authors for filter dropdown
  const authors = useMemo(() => {
    const uniqueAuthors = new Set();
    comments.forEach(comment => {
      if (comment.author?.displayName) {
        uniqueAuthors.add(JSON.stringify({
          accountId: comment.author.accountId,
          displayName: comment.author.displayName
        }));
      }
    });
    return Array.from(uniqueAuthors).map(author => JSON.parse(author));
  }, [comments]);

  // Filter and search comments
  const filteredComments = useMemo(() => {
    return comments.filter(comment => {
      // Search term filter
      if (searchTerm) {
        const commentText = extractTextFromAdf(comment.body).toLowerCase();
        const renderedText = comment.renderedBody ? 
          comment.renderedBody.replace(/<[^>]*>/g, '').toLowerCase() : '';
        const authorName = comment.author?.displayName?.toLowerCase() || '';
        
        const searchLower = searchTerm.toLowerCase();
        if (!commentText.includes(searchLower) && 
            !renderedText.includes(searchLower) && 
            !authorName.includes(searchLower)) {
          return false;
        }
      }

      // Author filter
      if (selectedAuthor !== 'all' && comment.author?.accountId !== selectedAuthor) {
        return false;
      }

      // Date range filter
      const commentDate = new Date(comment.created);
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        fromDate.setHours(0, 0, 0, 0);
        if (commentDate < fromDate) return false;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999); // End of day
        if (commentDate > toDate) return false;
      }

      return true;
    });
  }, [comments, searchTerm, selectedAuthor, dateFrom, dateTo]);

  // Calculate statistics
  const stats = useMemo(() => {
    const authorCounts = {};
    const totalWords = filteredComments.reduce((total, comment) => {
      const author = comment.author?.displayName || 'Unknown';
      authorCounts[author] = (authorCounts[author] || 0) + 1;
      
      const text = extractTextFromAdf(comment.body);
      return total + text.split(/\s+/).filter(word => word.length > 0).length;
    }, 0);

    const avgWordsPerComment = filteredComments.length > 0 ? 
      Math.round(totalWords / filteredComments.length) : 0;

    return {
      totalComments: filteredComments.length,
      totalWords,
      avgWordsPerComment,
      authorCounts,
      topAuthor: Object.entries(authorCounts).sort((a, b) => b[1] - a[1])[0]
    };
  }, [filteredComments]);

  if (loading) {
    return (
      <Stack space="space.200" alignInline="center">
        <Spinner size="large" />
        <Text>Loading comments...</Text>
      </Stack>
    );
  }

  if (error) {
    return (
      <SectionMessage appearance="error">
        <Text><Strong>Error:</Strong> {error}</Text>
      </SectionMessage>
    );
  }

  if (comments.length === 0) {
    return (
      <EmptyState
        header="No comments found"
        description="This issue doesn't have any comments yet."
      />
    );
  }

  return (
    <Stack space="space.300">
      {/* Statistics Panel */}
      <Box xcss={cardStyle}>
        <Stack space="space.200">
          <Inline space="space.200" alignBlock="center">
            <Heading size="small">Comment Statistics</Heading>
            <Button 
              appearance="subtle" 
              onClick={() => dispatch({ type: ACTIONS.TOGGLE_STATS })}
            >
              {showStats ? 'Hide' : 'Show'}
            </Button>
          </Inline>
          {showStats && (
            <Inline space="space.300" spread="space-between">
              <Stack space="space.050">
                <Text size="small"><Strong>{stats.totalComments}</Strong> comments shown</Text>
                <Text size="small">({total} total)</Text>
              </Stack>
              <Stack space="space.050">
                <Text size="small"><Strong>{stats.totalWords}</Strong> total words</Text>
                <Text size="small">~{stats.avgWordsPerComment} words/comment</Text>
              </Stack>
              {stats.topAuthor && (
                <Stack space="space.050">
                  <Text size="small">Most active: <Strong>{stats.topAuthor[0]}</Strong></Text>
                  <Text size="small">{stats.topAuthor[1]} comments</Text>
                </Stack>
              )}
            </Inline>
          )}
        </Stack>
      </Box>

      {/* Search and Filter Controls */}
      <Box xcss={cardStyle}>
        <Stack space="space.200">
          <Inline space="space.200" alignBlock="center">
            <Heading size="small">Search & Filter</Heading>
            <Button 
              appearance="subtle" 
              onClick={() => dispatch({ type: ACTIONS.TOGGLE_FILTERS })}
            >
              {showFilters ? 'Hide' : 'Show'}
            </Button>
            {(searchTermInput || selectedAuthor !== 'all' || dateFrom || dateTo) && (
              <Text size="small" appearance="subtle">
                (filters active)
              </Text>
            )}
          </Inline>
          
          {showFilters && (
            <Stack space="space.200">
              {/* Search */}
              <Textfield
                name="search"
                placeholder="Search comments, authors, or content..."
                value={searchTermInput}
                onChange={(e) => dispatch({ type: ACTIONS.SET_SEARCH_INPUT, payload: e.target.value })}
              />
              
              {/* Filter Controls */}
              <Inline space="space.200" alignBlock="center">
                {/* Author Filter */}
                <Stack space="space.050">
                  <Text size="small"><Strong>Author</Strong></Text>
                  <Select
                    value={selectedAuthor}
                    onChange={(e) => dispatch({ type: ACTIONS.SET_AUTHOR_FILTER, payload: e.target.value })}
                  >
                    <option value="all">All authors</option>
                    {authors.map(author => (
                      <option key={author.accountId} value={author.accountId}>
                        {author.displayName}
                      </option>
                    ))}
                  </Select>
                </Stack>

                {/* Date Range */}
                <Stack space="space.050">
                  <Text size="small"><Strong>From Date</Strong></Text>
                  <DatePicker
                    value={dateFrom}
                    onChange={(date) => dispatch({ type: ACTIONS.SET_DATE_FROM, payload: date })}
                  />
                </Stack>
                
                <Stack space="space.050">
                  <Text size="small"><Strong>To Date</Strong></Text>
                  <DatePicker
                    value={dateTo}
                    onChange={(date) => dispatch({ type: ACTIONS.SET_DATE_TO, payload: date })}
                  />
                </Stack>

                {/* Clear Filters */}
                <Button
                  appearance="subtle"
                  onClick={() => dispatch({ type: ACTIONS.CLEAR_FILTERS })}
                >
                  Clear All
                </Button>
              </Inline>
            </Stack>
          )}
        </Stack>
      </Box>

      {/* Header with sort controls */}
      <Stack space="space.200">
        <Inline space="space.200" alignBlock="center">
          <Text>
            <Strong>Comments ({stats.totalComments} shown)</Strong>
          </Text>
          <ButtonGroup>
            <Button 
              appearance={sortOrder === 'created' ? 'primary' : 'default'}
              onClick={() => dispatch({ type: ACTIONS.SET_SORT_ORDER, payload: 'created' })}
            >
              Oldest First
            </Button>
            <Button 
              appearance={sortOrder === '-created' ? 'primary' : 'default'}
              onClick={() => dispatch({ type: ACTIONS.SET_SORT_ORDER, payload: '-created' })}
            >
              Newest First
            </Button>
          </ButtonGroup>
        </Inline>
      </Stack>

      {/* Comments list */}
      {filteredComments.map((comment, index) => (
        <Stack key={comment.id} space="space.200">
          {/* Comment header - author and date on same line */}
          <Inline space="space.100" alignBlock="start">
            <User accountId={comment.author?.accountId} />
            <Text>added a comment - {formatDate(comment.created)}</Text>
          </Inline>

          {/* Comment content with ADF rendering */}
          <Box>
            {comment.body && comment.body.content ? (
              <AdfRenderer document={comment.body} />
            ) : (
              <Text>{extractTextFromAdf(comment.body) || 'No content'}</Text>
            )}
          </Box>
          
          {/* Add separator after each comment except the last one */}
          {index < filteredComments.length - 1 && (
            <Box
              xcss={xcss({
                borderBottom: '1px solid',
                borderColor: 'color.border',
                borderStyle: 'solid',
                marginTop: 'space.200'
              })}
            />
          )}
        </Stack>
      ))}

      {/* Load more buttons */}
      {hasMore && (
        <Box>
          <ButtonGroup>
            <Button
              onClick={() => loadMoreComments(false)}
              appearance="default"
              isLoading={loadingMore}
            >
              {loadingMore ? 'Loading...' : 'Load more comments'}
            </Button>
            <Button
              onClick={() => loadMoreComments(true)}
              appearance="primary"
              isLoading={loadingMore}
            >
              {loadingMore ? 'Loading...' : 'Load ALL remaining'}
            </Button>
          </ButtonGroup>
        </Box>
      )}

    </Stack>
  );
};

ForgeReconciler.render(<CommentsList />);