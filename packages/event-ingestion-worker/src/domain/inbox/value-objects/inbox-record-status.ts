// A single value today, kept as its own type (not inlined) for forward compatibility if this
// worker ever needs to track post-ingestion state itself — see the package README's "Inbox
// record shape". Delivery status lives entirely on webhook-delivery-worker's own records.
export type InboxRecordStatus = 'INGESTED';
