# InternTrack - Systems Architecture Documentation

## Overview

InternTrack is a full-stack web application that helps users track internship opportunities across multiple companies. The system combines a React frontend with Supabase backend services, including serverless edge functions for data scraping and enrichment.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                  │
│  - React 18 + TypeScript                                    │
│  - React Router for navigation                              │
│  - TanStack Query for data fetching                         │
│  - Tailwind CSS + shadcn/ui components                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS/REST API
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Supabase Platform                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Authentication Service                               │  │
│  │  - Email/password auth                                │  │
│  │  - Session management                                 │  │
│  │  - Row-level security (RLS) policies                  │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  PostgreSQL Database                                  │  │
│  │  - User profiles                                      │  │
│  │  - Companies table                                    │  │
│  │  - Job listings                                       │  │
│  │  - User watchlists                                    │  │
│  │  - Job alerts                                         │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Edge Functions (Deno Runtime)                       │  │
│  │  - add-company                                        │  │
│  │  - scrape-careers                                     │  │
│  │  - scrape-company-info                                │  │
│  │  - search-linkedin-companies                          │  │
│  │  - validate-linkedin-company                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP Requests
                            │
┌─────────────────────────────────────────────────────────────┐
│              External Data Sources                           │
│  - LinkedIn (company search)                                │
│  - Wikipedia (company information)                          │
│  - Company career pages (job scraping)                      │
└─────────────────────────────────────────────────────────────┘
```

## Core Platforms & Technologies

### 1. Frontend Stack

**React + Vite**
- **Purpose**: Modern, fast development and build toolchain
- **Key Features**: Hot module replacement, TypeScript support, optimized builds
- **Routing**: React Router DOM for client-side navigation
- **State Management**: React Query (TanStack Query) for server state, React hooks for local state

**UI Framework**
- **Tailwind CSS**: Utility-first CSS framework for styling
- **shadcn/ui**: Component library built on Radix UI primitives
- **Purpose**: Consistent, accessible UI components with minimal bundle size

**Key Libraries**
- **React Query**: Handles data fetching, caching, and synchronization with backend
- **React Hook Form**: Form state management and validation
- **Zod**: Schema validation for TypeScript

### 2. Backend Platform: Supabase

**Supabase** serves as the complete backend-as-a-service platform, providing:

#### Authentication System
- **Service**: Built-in email/password authentication
- **Session Management**: JWT tokens stored in browser localStorage
- **Security**: Automatic token refresh, secure session handling
- **Integration**: Seamlessly integrated with database RLS policies

#### Database System
- **Database**: PostgreSQL (managed by Supabase)
- **Row-Level Security (RLS)**: Fine-grained access control at the database level
- **Features**:
  - Automatic triggers for user profile creation
  - Timestamp auto-updates
  - Foreign key relationships with cascade deletes
  - Full-text search capabilities

**Key Tables**:
- `profiles`: User profile data linked to auth.users
- `companies`: Public company directory
- `user_watchlist`: Many-to-many relationship between users and companies
- `job_listings`: Scraped internship postings
- `job_alerts`: User alert preferences
- `career_pages`: Company career page URLs

#### Edge Functions
- **Runtime**: Deno (serverless functions)
- **Purpose**: Server-side logic that requires elevated permissions or external API access
- **Deployment**: Deployed separately from frontend, invoked via HTTPS
- **Authentication**: Uses service role key to bypass RLS when needed

### 3. External Data Sources

**LinkedIn**
- **Purpose**: Company search and logo extraction
- **Method**: Web scraping LinkedIn company pages
- **Edge Function**: `search-linkedin-companies`

**Wikipedia**
- **Purpose**: Company descriptions and industry information
- **Method**: Wikipedia REST API (`/api/rest_v1/page/summary`)
- **Edge Function**: `scrape-company-info`

**Company Career Pages**
- **Purpose**: Job listing data
- **Method**: Web scraping HTML pages and parsing structured data (JSON-LD, microdata)
- **Edge Function**: `scrape-careers`

## System Interactions & Data Flow

### 1. Authentication Flow

```
User → Frontend → Supabase Auth Service → Database
  ↓
  JWT Token Generated
  ↓
  Stored in localStorage
  ↓
  Included in all subsequent API requests
  ↓
  Database RLS policies validate user context
```

**Key Points**:
- Authentication state managed by Supabase client
- Frontend automatically includes auth token in API calls
- RLS policies enforce user-specific data access
- Session persists across browser sessions

### 2. Company Watchlist Management

**Adding a Company**:
```
User searches → Frontend calls search-linkedin-companies edge function
  ↓
Edge function searches LinkedIn → Returns company suggestions
  ↓
User selects company → Frontend calls add-company edge function
  ↓
Edge function:
  1. Validates user authentication
  2. Checks if company exists in database
  3. Creates company if needed (using service role to bypass RLS)
  4. Adds to user's watchlist (uses user context, respects RLS)
  ↓
Returns success → Frontend refreshes watchlist
```

**Key Points**:
- Two-step process: search externally, then add to database
- Edge functions use service role for database writes (bypasses RLS)
- User context still validated for security
- Watchlist additions respect RLS (users can only manage their own watchlist)

### 3. Job Scraping Workflow

**Manual Refresh Trigger**:
```
User clicks "Refresh Jobs" → Frontend calls scrape-careers edge function
  ↓
Edge function:
  1. Retrieves user's watchlist companies
  2. Fetches career page URLs from database
  3. For each company:
     - Fetches HTML from career page
     - Parses structured data (JSON-LD, microdata, HTML)
     - Extracts job details (title, description, location, etc.)
     - Filters for internship positions
     - Geographically filters if specified
  4. Upserts jobs to database (service role bypasses RLS)
  ↓
Returns job count → Frontend refreshes job listings
```

**Key Points**:
- Scraping runs server-side (edge functions) to avoid CORS issues
- Uses service role key for database writes
- Handles multiple parsing strategies (JSON-LD, microdata, HTML)
- Filters invalid job titles and non-internship positions
- Prevents duplicates via database constraints

### 4. Data Access Patterns

**Reading Data**:
- Frontend queries Supabase directly using client SDK
- RLS policies automatically filter data based on authenticated user
- React Query caches responses for performance
- Real-time subscriptions possible (not currently implemented)

**Writing Data**:
- **User-specific data** (watchlist, alerts): Direct database writes with RLS
- **Shared data** (companies, job listings): Edge functions with service role
- **Rationale**: Shared data requires elevated permissions to prevent conflicts

### 5. Company Information Enrichment

```
User views company → Frontend calls scrape-company-info edge function
  ↓
Edge function:
  1. Attempts Wikipedia API for description
  2. Falls back to scraping company website
  3. Updates company record in database
  ↓
Returns enriched data → Frontend displays updated information
```

## Security Architecture

### Row-Level Security (RLS)

**Principle**: Database-level access control enforced by PostgreSQL policies

**Policies**:
- **Companies**: Public read, authenticated insert via edge function
- **Job Listings**: Public read, authenticated insert via edge function
- **User Watchlist**: Users can only view/modify their own watchlist
- **Job Alerts**: Users can only manage their own alerts
- **Profiles**: Users can only view/update their own profile

**Implementation**:
- Policies use `auth.uid()` function to get current user ID
- Edge functions use service role key for operations requiring elevated permissions
- User context still validated in edge functions before using service role

### Authentication Security

- JWT tokens with automatic refresh
- Tokens stored securely in localStorage
- All API requests include Authorization header
- Edge functions validate user authentication before processing

## Edge Functions Architecture

### Function Types

1. **User-Triggered Functions**
   - `add-company`: Adds companies to database and user watchlist
   - `scrape-careers`: Manually triggers job scraping
   - `scrape-company-info`: Enriches company data
   - `search-linkedin-companies`: Searches LinkedIn for companies

2. **Data Processing Functions**
   - All functions use service role key for database operations
   - All functions validate user authentication first
   - Functions handle CORS for browser requests

### Deployment Model

- Functions deployed independently from frontend
- Accessed via HTTPS endpoints
- Environment variables for configuration (Supabase URL, keys)
- Deno runtime (not Node.js) - TypeScript-first, secure by default

## Data Persistence

### Database Schema Relationships

```
auth.users (Supabase managed)
  ↓
profiles (1:1 with auth.users)
  ↓
user_watchlist (many-to-many)
  ↓
companies (shared, many-to-many via watchlist)
  ↓
job_listings (1:many from companies)
  ↓
career_pages (1:many from companies)
```

### Data Lifecycle

- **Companies**: Created once, shared across all users
- **Job Listings**: Scraped periodically, deduplicated by title/company/URL
- **User Data**: Created on signup, deleted on account deletion (cascade)
- **Watchlist**: User-specific, many-to-many relationship

## External Integrations

### LinkedIn Integration
- **Method**: Web scraping (no official API)
- **Rate Limiting**: Handled by edge function timeout/abort
- **Data Extracted**: Company names, LinkedIn URLs, logos

### Wikipedia Integration
- **Method**: Official REST API
- **Endpoint**: `/api/rest_v1/page/summary`
- **Data Extracted**: Company descriptions

### Company Websites
- **Method**: HTTP scraping with HTML parsing
- **Parsing Strategies**: JSON-LD structured data, microdata, HTML fallback
- **Data Extracted**: Job titles, descriptions, locations, deadlines, skills

## Scalability Considerations

### Current Architecture Strengths
- Serverless edge functions scale automatically
- Database connection pooling handled by Supabase
- React Query caching reduces database load
- RLS policies enforce security at database level

### Potential Bottlenecks
- Sequential scraping in `scrape-careers` function
- External API rate limits (LinkedIn, Wikipedia)
- HTML parsing performance for large career pages

### Future Optimization Opportunities
- Parallel scraping for multiple companies
- Background job processing via Supabase cron jobs
- Caching of scraped company information
- Rate limiting and retry logic for external APIs

## Development & Deployment

### Development Environment
- **Frontend**: Vite dev server (localhost:8080)
- **Backend**: Supabase local development (via Supabase CLI)
- **Environment Variables**: `.env` file for Supabase credentials

### Deployment
- **Frontend**: Deployed via Lovable platform (can be deployed to Vercel/Netlify)
- **Backend**: Supabase cloud platform (managed)
- **Edge Functions**: Deployed via Supabase CLI (`supabase functions deploy`)

### Configuration Management
- Environment variables for API keys and URLs
- Supabase project configuration in `supabase/config.toml`
- Database migrations in `supabase/migrations/`

## Monitoring & Observability

### Current State
- Console logging in edge functions
- Supabase dashboard for database monitoring
- No centralized logging or error tracking (future enhancement)

### Recommended Additions
- Error tracking service (Sentry, LogRocket)
- Performance monitoring
- Scraping success rate tracking
- User activity analytics

