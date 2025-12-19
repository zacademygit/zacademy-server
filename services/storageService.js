import { supabase, bucketName } from '../config/supabase.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Upload file to Supabase Storage
 * @param {Object} file - Multer file object with buffer
 * @returns {Promise<string>} Public URL of uploaded file
 */
export const uploadToSupabase = async (file) => {
    if (!supabase) {
        throw new Error('Supabase is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.');
    }

    try {
        // Generate unique filename
        const fileExt = file.originalname.split('.').pop();
        const fileName = `${uuidv4()}.${fileExt}`;
        const filePath = `mentors/${fileName}`;

        // Upload file to Supabase
        const { data, error } = await supabase.storage
            .from(bucketName)
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            throw error;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from(bucketName)
            .getPublicUrl(filePath);

        return urlData.publicUrl;

    } catch (error) {
        console.error('Supabase upload error:', error);
        throw new Error('Failed to upload file to storage');
    }
};

/**
 * Delete file from Supabase Storage
 * @param {string} fileUrl - Public URL of the file to delete
 * @returns {Promise<boolean>}
 */
export const deleteFromSupabase = async (fileUrl) => {
    if (!supabase) {
        console.warn('Supabase is not configured. Cannot delete file.');
        return false;
    }

    try {
        // Extract file path from URL
        const url = new URL(fileUrl);
        const filePath = url.pathname.split(`${bucketName}/`)[1];

        const { error } = await supabase.storage
            .from(bucketName)
            .remove([filePath]);

        if (error) {
            throw error;
        }

        return true;
    } catch (error) {
        console.error('Supabase delete error:', error);
        throw new Error('Failed to delete file from storage');
    }
};
