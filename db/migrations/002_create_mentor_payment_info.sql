-- Drop the existing table if it exists
DROP TABLE IF EXISTS mentor_payment_info CASCADE;

-- Create mentor_payment_info table
-- This table stores mentor's bank account information for receiving payments
-- Includes identification, address, bank details, and RTGS code
CREATE TABLE mentor_payment_info (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mentor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    -- Personal Identification
    identification_number VARCHAR(50) NOT NULL, -- ID or passport number

    -- Address Information
    address TEXT NOT NULL, -- Full address

    -- Bank Information
    bank VARCHAR(255) NOT NULL, -- Bank name (TBC Bank, Bank of Georgia, Liberty Bank, Credo Bank, Procredit Bank, or custom)
    bank_rtgs_code VARCHAR(20) NOT NULL, -- Bank RTGS/SWIFT code (find at https://nbg.gov.ge/payment-system/iban)
    bank_account_number VARCHAR(100) NOT NULL, -- Bank account number (IBAN or account number)

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    UNIQUE(mentor_id) -- One payment info record per mentor
);

-- Create index on mentor_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_mentor_payment_info_mentor_id ON mentor_payment_info(mentor_id);

-- Trigger to automatically update updated_at for mentor_payment_info
CREATE TRIGGER update_mentor_payment_info_updated_at BEFORE UPDATE ON mentor_payment_info
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE mentor_payment_info IS 'Stores mentor payment information including bank details and identification for payment processing';
COMMENT ON COLUMN mentor_payment_info.identification_number IS 'Identification number (ID or passport number)';
COMMENT ON COLUMN mentor_payment_info.address IS 'Full address of the mentor';
COMMENT ON COLUMN mentor_payment_info.bank IS 'Bank name (predefined options or custom bank name)';
COMMENT ON COLUMN mentor_payment_info.bank_rtgs_code IS 'Bank RTGS/SWIFT code - can be found at https://nbg.gov.ge/payment-system/iban';
COMMENT ON COLUMN mentor_payment_info.bank_account_number IS 'Bank account number (IBAN or local account number)';
