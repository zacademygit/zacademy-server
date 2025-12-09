-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
-- This table stores common information for both users and mentors
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    country_code VARCHAR(10) DEFAULT '+995',
    date_of_birth DATE,
    user_type VARCHAR(20) NOT NULL CHECK (user_type IN ('user', 'mentor')),
    agree_to_terms BOOLEAN DEFAULT false,
    agree_to_marketing BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_user_type ON users(user_type);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at for users
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create marketing_consent_history table
CREATE TABLE IF NOT EXISTS marketing_consent_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    consent_given BOOLEAN NOT NULL,
    consent_method VARCHAR(50), -- 'signup', 'settings', 'email', 'campaign'
    ip_address INET,
    user_agent TEXT,
    source VARCHAR(100), -- where the change was made: 'web_app', 'mobile_app', 'admin'
    campaign_id VARCHAR(100), -- if related to specific campaign
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_marketing_consent_history_user_id ON marketing_consent_history(user_id);
CREATE INDEX IF NOT EXISTS idx_marketing_consent_history_created_at ON marketing_consent_history(created_at);

-- Create mentor_details table
-- This table stores additional information specific to mentors
CREATE TABLE IF NOT EXISTS mentor_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    occupation_area VARCHAR(255) NOT NULL,
    current_position VARCHAR(255) NOT NULL,
    company VARCHAR(255),
    years_of_experience VARCHAR(50),
    university VARCHAR(255) NOT NULL,
    faculty VARCHAR(255) NOT NULL,
    bio TEXT NOT NULL,
    linkedin VARCHAR(500),
    photo_url VARCHAR(500),
    application_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (application_status IN ('pending', 'approved', 'rejected')),
    rejection_reason TEXT, -- Reason for rejection (if application_status is 'rejected')
    notes TEXT, -- Admin notes about the mentor
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Create index on user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_mentor_details_user_id ON mentor_details(user_id);
CREATE INDEX IF NOT EXISTS idx_mentor_details_application_status ON mentor_details(application_status);

-- Trigger to automatically update updated_at for mentor_details
CREATE TRIGGER update_mentor_details_updated_at BEFORE UPDATE ON mentor_details
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create mentor_document_confirmations table
-- This table stores mentor's document type selection and confirmation
-- Mentors must choose between Individual Entrepreneur or Private Individual
CREATE TABLE IF NOT EXISTS mentor_document_confirmations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('individual_entrepreneur', 'private_individual')),
    confirmed BOOLEAN DEFAULT true,
    confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(mentor_id) -- One confirmation record per mentor, cannot be changed once confirmed
);

-- Create index on mentor_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_mentor_document_confirmations_mentor_id ON mentor_document_confirmations(mentor_id);

-- Trigger to automatically update updated_at for mentor_document_confirmations
CREATE TRIGGER update_mentor_document_confirmations_updated_at BEFORE UPDATE ON mentor_document_confirmations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create mentor_availability table
-- This table stores mentor availability schedules with timezone support
-- Schedule is stored as JSONB for flexible weekly recurring patterns
CREATE TABLE IF NOT EXISTS mentor_availability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    timezone VARCHAR(100) NOT NULL, -- IANA timezone identifier (e.g., 'America/New_York', 'Europe/London')
    schedule JSONB NOT NULL DEFAULT '{}'::jsonb, -- Weekly schedule: {"monday": [{"start": "09:00", "end": "17:00"}], ...}
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(mentor_id) -- One availability record per mentor
);

-- Create index on mentor_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_mentor_availability_mentor_id ON mentor_availability(mentor_id);

-- Trigger to automatically update updated_at for mentor_availability
CREATE TRIGGER update_mentor_availability_updated_at BEFORE UPDATE ON mentor_availability
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create mentor_services table
-- This table stores mentor service offerings and pricing
-- All fees are calculated on frontend: platform_fee (14%), taxes_fee (26%)
CREATE TABLE IF NOT EXISTS mentor_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mentorship_service VARCHAR(255) NOT NULL, -- Service type: 'Profession Introduction Session'
    mentor_session_price INTEGER NOT NULL, -- Mentor's base price (what mentor receives, whole numbers only in GEL)
    platform_fee INTEGER NOT NULL, -- Platform fee: 14% of mentor_session_price
    taxes_fee INTEGER NOT NULL, -- Taxes: 26% of mentor_session_price
    total_price INTEGER NOT NULL, -- Total price student pays (mentor_session_price + platform_fee + taxes_fee)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(mentor_id, mentorship_service), -- One price per service type per mentor
    -- Constraints
    CHECK (mentor_session_price > 0),
    CHECK (platform_fee >= 0),
    CHECK (taxes_fee >= 0),
    CHECK (total_price > 0),
    CHECK (total_price = mentor_session_price + platform_fee + taxes_fee)
);

-- Create index on mentor_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_mentor_services_mentor_id ON mentor_services(mentor_id);

-- Trigger to automatically update updated_at for mentor_services
CREATE TRIGGER update_mentor_services_updated_at BEFORE UPDATE ON mentor_services
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create mentor_payment_info table
-- This table stores mentor's bank account information for receiving payments
-- Kept separate for security and data isolation
CREATE TABLE IF NOT EXISTS mentor_payment_info (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bank_account_number VARCHAR(100) NOT NULL,
    bank_name VARCHAR(255), -- Optional: name of the bank
    account_holder_name VARCHAR(255), -- Optional: name on the account
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(mentor_id) -- One payment info record per mentor
);

-- Create index on mentor_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_mentor_payment_info_mentor_id ON mentor_payment_info(mentor_id);

-- Trigger to automatically update updated_at for mentor_payment_info
CREATE TRIGGER update_mentor_payment_info_updated_at BEFORE UPDATE ON mentor_payment_info
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create bookings table
-- This table stores all booking/session information
-- All timestamps are stored in UTC - frontend handles timezone conversions
CREATE TABLE IF NOT EXISTS bookings (
    -- Primary Key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- References
    mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    service_id UUID REFERENCES mentor_services(id) ON DELETE SET NULL,

    -- Session Details (all times in UTC)
    session_date TIMESTAMP NOT NULL, -- Date & time in UTC
    duration_minutes INTEGER NOT NULL DEFAULT 60, -- Session duration in minutes
    session_topic TEXT,
    notes TEXT, -- General notes about the booking

    -- Pricing (in GEL, whole numbers only)
    mentor_price INTEGER NOT NULL, -- What mentor receives
    platform_fee INTEGER NOT NULL, -- Platform's fee (20%)
    taxes_fee INTEGER NOT NULL DEFAULT 0, -- Taxes fee
    total_price INTEGER NOT NULL, -- What student pays (mentor_price + platform_fee + taxes_fee)

    -- Meeting Details
    meeting_link VARCHAR(500), -- Google Meet/Zoom/Teams link
    meeting_platform VARCHAR(50) DEFAULT 'google_meet', -- 'google_meet', 'zoom', 'teams', etc.

    -- Support Portal
    customer_portal_link VARCHAR(500), -- Link to customer support portal for this booking

    -- Status Tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    -- Status values: 'pending', 'confirmed', 'completed', 'cancelled_by_student', 'cancelled_by_mentor', 'no_show'

    payment_status VARCHAR(50) DEFAULT 'pending',
    -- Payment status: 'pending', 'paid', 'refunded', 'failed'

    -- Cancellation/Completion Details
    cancellation_reason TEXT,
    cancelled_at TIMESTAMP,
    cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL,
    completed_at TIMESTAMP,

    -- Timestamps (in UTC)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CHECK (duration_minutes > 0),
    CHECK (mentor_price > 0),
    CHECK (platform_fee >= 0),
    CHECK (taxes_fee >= 0),
    CHECK (total_price > 0),
    CHECK (total_price = mentor_price + platform_fee + taxes_fee)
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_bookings_mentor_id ON bookings(mentor_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user_id ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_session_date ON bookings(session_date);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status ON bookings(payment_status);
CREATE INDEX IF NOT EXISTS idx_bookings_mentor_date ON bookings(mentor_id, session_date);
CREATE INDEX IF NOT EXISTS idx_bookings_user_date ON bookings(user_id, session_date);

-- Trigger to automatically update updated_at for bookings
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
