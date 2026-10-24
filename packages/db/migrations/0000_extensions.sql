create extension if not exists citext;
create domain localized_text as jsonb check (value is null or (jsonb_typeof(value) = 'object' and jsonb_typeof(value->'id') = 'string'));
create sequence booking_code_seq;
create sequence invoice_number_seq;
