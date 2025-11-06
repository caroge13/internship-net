# InternTrack - Internship Finder Platform

A full-stack web application that helps users track multiple companies' internship postings, get job alerts, and access detailed insights including visa sponsorship, acceptance rates, and company culture.

## 🚧 Work in Progress! Still developing MVP, so features may be incomplete or unstable.

## 🚀 Features

- **Multi-Company Tracking**: Add all your target companies to one personalized watchlist (supports adding multiple companies at once)
- **Instant Job Alerts**: Get notified immediately when companies post new internship opportunities
- **Geography Filtering**: Filter jobs by location (Canada, US, Remote, etc.)
- **Detailed Job Insights**: View acceptance rates, key skills, deadlines, visa sponsorship status
- **Company Information**: Access company culture, values, and descriptions
- **Career Page Scraping**: Refresh jobs to scrape company career pages automatically

## 🛠️ Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **TanStack Query** - Server state management
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Component library (built on Radix UI)

### Backend
- **Supabase** - Backend-as-a-Service platform
  - **PostgreSQL Database** - Data persistence with Row-Level Security (RLS)
  - **Authentication** - Email/password auth with JWT tokens
  - **Edge Functions** - Serverless functions (Deno runtime) for:
    - Company search and addition
    - Career page scraping
    - Company information enrichment
    - LinkedIn company search

### External Integrations
- **LinkedIn** - Company search and logo extraction
- **Wikipedia** - Company descriptions via REST API
- **Company Career Pages** - Job listing scraping

## 📁 Project Structure

```
internship-net/
├── src/
│   ├── components/          # React components
│   │   ├── ui/              # shadcn/ui components
│   │   ├── CompanyWatchlist.tsx
│   │   ├── JobListingCard.tsx
│   │   └── Navbar.tsx
│   ├── pages/               # Route pages
│   │   ├── Index.tsx        # Landing page
│   │   ├── Auth.tsx         # Authentication
│   │   ├── Dashboard.tsx    # Main app dashboard
│   │   └── NotFound.tsx
│   ├── integrations/
│   │   └── supabase/        # Supabase client configuration
│   ├── hooks/               # Custom React hooks
│   └── lib/                 # Utility functions
├── supabase/
│   ├── functions/           # Edge Functions
│   │   ├── add-company/
│   │   ├── scrape-careers/
│   │   ├── scrape-company-info/
│   │   └── search-linkedin-companies/
│   └── migrations/          # Database migrations
└── public/                  # Static assets
```

## 🏃 Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account (free tier works)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <https://github.com/caroge13/internship-net>
   cd internship-net
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
   ```
   
   Get these values from your Supabase project settings → API.

4. **Set up the database**
   
   - Go to your Supabase Dashboard → SQL Editor
   - Open `full-database-setup.sql` from this repository
   - Copy and paste the entire contents into the SQL Editor
   - Click "Run" to execute
   
   This creates all necessary tables, relationships, and Row-Level Security policies.

5. **Deploy Edge Functions** (Required for full functionality)
   
   **Using Supabase Dashboard**
   - Go to Edge Functions in your Supabase Dashboard
   - Create each function manually and paste the code from `supabase/functions/[function-name]/index.ts`
   
   **Set Edge Function Secrets:**
   - In Supabase Dashboard → Edge Functions → Secrets
   - Add secret: `SUPABASE_SERVICE_ROLE_KEY` with your service role key
   - Get service role key from Project Settings → API

6. **Start the development server**
   ```bash
   npm run dev
   ```
   
   The app will be available at the local host link in terminal

## 📚 Documentation

- **[Systems Architecture](./SYSTEMS_ARCHITECTURE.md)** - Comprehensive systems-level documentation covering architecture, platforms, and system interactions

## 🎯 Usage

### Adding Companies

1. Sign up or sign in to your account
2. Navigate to the Dashboard
3. In the "My Watchlist" tab, enter company names (separate multiple companies with commas or new lines)
4. Click "Add" to add them to your watchlist

### Viewing Job Listings

1. Go to the "Job Listings" tab
2. Use the geography filter to search by location (e.g., "Canada", "Remote", "US")
3. Click "Refresh Jobs" to scrape the latest internships from company career pages
4. View detailed information including:
   - Job title and description
   - Post date and deadline
   - Location and visa sponsorship status
   - Key skills
   - Acceptance rate

### Setting Up Job Alerts

- Click the bell icon next to any company in your watchlist
- You'll receive notifications when new internships are posted

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

### Database Migrations

Database migrations are located in `supabase/migrations/`. To apply migrations:
- Manually run SQL files in Supabase Dashboard → SQL Editor

## 🚢 Deployment

### Frontend Deployment

The frontend can be deployed to any static hosting service:
- **Vercel**: Connect your GitHub repo and deploy
- **Netlify**: Connect your GitHub repo and deploy
- **Lovable**: Use the built-in deployment feature

### Backend Deployment

- **Supabase**: Already hosted on Supabase cloud platform
- **Edge Functions**: Deploy using Supabase CLI or Dashboard

## 🔒 Security

- **Row-Level Security (RLS)**: All database tables have RLS policies enforcing user-specific access
- **Authentication**: JWT-based authentication with automatic token refresh
- **Edge Functions**: Use service role key for elevated permissions, but validate user authentication first

## 📝 License

This project is private and proprietary.

## 🤝 Contributing

This is a personal project. For questions or issues, please open an issue in the repository.
