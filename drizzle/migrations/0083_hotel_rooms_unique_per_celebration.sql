ALTER TABLE public.hotel_rooms DROP CONSTRAINT IF EXISTS hotel_rooms_vendor_id_room_number_key;
DROP INDEX IF EXISTS public.hotel_rooms_vendor_id_room_number_key;
CREATE UNIQUE INDEX IF NOT EXISTS hotel_rooms_invite_vendor_room_key ON public.hotel_rooms (invite_id, vendor_id, room_number);