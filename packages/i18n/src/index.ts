export type Locale = 'id' | 'en';
const errorMessages: Record<string, string> = {
  approval_required: 'Tinjau dan setujui versi penawaran ini sebelum membayar.',
  readiness_incomplete:
    'Bukti kesiapan belum lengkap. Hubungi Citadel untuk penawaran yang telah diperiksa.',
  interest_only:
    'Perjalanan ini masih disiapkan. Gunakan formulir minat untuk menghubungi Citadel.',
  invoice_not_payable:
    'Batas pembayaran sudah lewat atau tagihan tidak dapat dibayar. Hubungi Citadel untuk penawaran baru.',
  email_unverified: 'Verifikasi email Anda sebelum mengajukan atau membayar perjalanan.',
  phone_required: 'Tambahkan nomor WhatsApp Anda untuk melanjutkan.',
  traveler_locked:
    'Detail traveler dikelola admin setelah konfirmasi. Hubungi Citadel untuk perubahan.',
  payment_provider: 'Layanan pembayaran belum tersedia. Coba lagi atau hubungi Citadel.',
  payment_review: 'Pembayaran sedang ditinjau. Hubungi Citadel sebelum membayar kembali.',
  payment_in_progress:
    'Pembayaran sedang dikonfirmasi. Tunggu pembaruan sebelum mengubah penawaran.',
  manual_payment: 'Hubungi Citadel untuk mengatur pembayaran melalui transfer bank.',
  invalid_transition:
    'Tindakan ini tidak tersedia pada status saat ini. Muat ulang halaman atau hubungi Citadel.',
  validation: 'Periksa dan lengkapi kolom formulir Anda, lalu coba lagi.',
  capacity: 'Tempat keberangkatan tidak mencukupi. Pilih tanggal lain atau hubungi Citadel.',
  duplicate_traveler:
    'Traveler sudah dipilih atau memiliki pemesanan pada keberangkatan ini. Periksa pilihan Anda.',
  unauthorized: 'Sesi Anda berakhir. Silakan masuk kembali.',
  not_found: 'Data tidak ditemukan. Kembali ke halaman sebelumnya atau hubungi Citadel.',
  bot_check: 'Selesaikan pemeriksaan keamanan, lalu coba lagi.',
  weak_password: 'Pilih kata sandi lain yang belum muncul dalam kebocoran data.',
  invalid_credentials:
    'Email atau kata sandi tidak sesuai. Periksa kembali atau atur ulang kata sandi.',
  invalid_token: 'Tautan tidak berlaku atau sudah digunakan. Minta tautan baru.',
  server_error: 'Permintaan belum dapat diproses. Coba lagi atau hubungi Citadel.',
};
export function errorText(code: string, message: string, locale: Locale) {
  return locale === 'id'
    ? errorMessages[code] ||
        'Permintaan belum dapat diproses. Periksa data Anda atau hubungi Citadel.'
    : message || 'Please try again or contact Citadel.';
}
export function text(value: any, locale: Locale = 'id'): string {
  if (!value) return '';
  return typeof value === 'string' ? value : value[locale] || value.id || '';
}
export function money(value: number | string) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value));
}
export function date(value: string, locale: Locale = 'id', full = false) {
  if (!value) return locale === 'id' ? 'Akan diumumkan' : 'To be announced';
  return new Intl.DateTimeFormat(locale === 'id' ? 'id-ID' : 'en-GB', {
    day: 'numeric',
    month: full ? 'long' : 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value));
}
export const labels: Record<string, { id: string; en: string }> = {
  tba: { id: 'Akan diumumkan', en: 'To be announced' },
  not_requested: { id: 'Belum diminta', en: 'Not requested' },
  partial: { id: 'Sebagian dialokasikan', en: 'Partly allocated' },
  allocated: { id: 'Dialokasikan', en: 'Allocated' },
  departure_confirmed: { id: 'Keberangkatan dikonfirmasi', en: 'Departure confirmed' },
  not_confirmed: { id: 'Belum dikonfirmasi', en: 'Not yet confirmed' },
  no_invoice: { id: 'Belum ada tagihan', en: 'No invoice yet' },
  approval_required: { id: 'Penawaran untuk disetujui', en: 'Offer to approve' },
  awaiting_payment: { id: 'Menunggu pembayaran', en: 'Awaiting payment' },
  planned: { id: 'Direncanakan', en: 'Planned' },
  handed_over: { id: 'Diserahkan', en: 'Handed over' },
  not_applicable: { id: 'Tidak berlaku', en: 'Not applicable' },
  requested: { id: 'Permintaan diterima', en: 'Request received' },
  reviewing: { id: 'Sedang ditinjau', en: 'Reviewing' },
  waitlisted: { id: 'Daftar tunggu', en: 'On waitlist' },
  offered: { id: 'Penawaran siap', en: 'Offer ready' },
  confirmed: { id: 'Dikonfirmasi', en: 'Confirmed' },
  completed: { id: 'Selesai', en: 'Completed' },
  declined: { id: 'Ditolak', en: 'Declined' },
  expired: { id: 'Kedaluwarsa', en: 'Expired' },
  cancelled: { id: 'Dibatalkan', en: 'Cancelled' },
  provisional: { id: 'Sementara', en: 'Provisional' },
  changed: { id: 'Berubah', en: 'Changed' },
  paid: { id: 'Lunas', en: 'Paid' },
  issued: { id: 'Siap', en: 'Ready' },
  draft: { id: 'Draf', en: 'Draft' },
  open: { id: 'Terbuka', en: 'Open' },
  not_started: { id: 'Sedang diatur', en: 'Being arranged' },
  approved: { id: 'Disetujui', en: 'Approved' },
  published: { id: 'Diterbitkan', en: 'Published' },
  collecting_documents: { id: 'Mengumpulkan dokumen', en: 'Collecting documents' },
  appointment_booked: { id: 'Janji telah dijadwalkan', en: 'Appointment booked' },
  submitted: { id: 'Diajukan', en: 'Submitted' },
  refused: { id: 'Ditolak', en: 'Refused' },
  not_required: { id: 'Tidak diperlukan', en: 'Not required' },
  pending_allocation: { id: 'Sedang diatur', en: 'Being arranged' },
  closed: { id: 'Ditutup', en: 'Closed' },
  in_progress: { id: 'Sedang berlangsung', en: 'In progress' },
  postponed: { id: 'Ditunda', en: 'Postponed' },
  void: { id: 'Dibatalkan', en: 'Void' },
  needs_review: { id: 'Perlu peninjauan', en: 'Needs review' },
  withdrawn: { id: 'Ditarik', en: 'Withdrawn' },
};
export function status(value: string, lang: Locale) {
  return labels[value]?.[lang] || value.replaceAll('_', ' ');
}
export const dictionaries = {
  id: {
    sport: 'Sport',
    how: 'Cara kerjanya',
    signin: 'Masuk',
    account: 'Perjalanan saya',
    season: 'Musim 2027',
    explore: 'Jelajahi pengalaman',
    hero: 'Be There When It Matters.',
    heroBody:
      'Rasakan langsung atmosfer pertandingan pilihan Anda. Citadel merancang perjalanan olahraga ke Eropa dengan pilihan pengalaman, akomodasi, dan layanan yang dijelaskan dalam penawaran personal Anda.',
    request: 'Ajukan perjalanan ini',
    enquire: 'Bicarakan perjalanan Anda',
    beyond: 'Di luar arena',
    beyondBody: 'Ketika perjalanan layak dinikmati sedikit lebih lama.',
    noTrips: 'Perjalanan Anda akan muncul di sini.',
    itinerary: 'Itinerary',
    documents: 'Dokumen',
    travelers: 'Traveler',
    payments: 'Pembayaran',
    overview: 'Ringkasan',
    save: 'Simpan',
    next: 'Lanjut',
    back: 'Kembali',
    send: 'Kirim permintaan',
    whatsapp: 'Tanya via WhatsApp',
    logout: 'Keluar',
  },
  en: {
    sport: 'Sport',
    how: 'How it works',
    signin: 'Sign in',
    account: 'My journeys',
    season: 'The 2027 season',
    explore: 'Explore experiences',
    hero: 'Be There When It Matters.',
    heroBody:
      'Experience the atmosphere of the sporting events you love. Citadel designs journeys to Europe around your chosen event, with experiences, accommodation and services clearly set out in your personal proposal.',
    request: 'Request this journey',
    enquire: 'Let’s arrange your journey',
    beyond: 'Beyond the event',
    beyondBody: 'For when the journey deserves a little longer.',
    noTrips: 'Your journeys will appear here.',
    itinerary: 'Itinerary',
    documents: 'Documents',
    travelers: 'Travelers',
    payments: 'Payments',
    overview: 'Overview',
    save: 'Save changes',
    next: 'Continue',
    back: 'Back',
    send: 'Send request',
    whatsapp: 'Ask on WhatsApp',
    logout: 'Sign out',
  },
};

export function time(value: string, lang: Locale, timezone = 'Asia/Jakarta') {
  return (
    new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    }).format(new Date(value)) + (timezone === 'Asia/Jakarta' ? ' WIB' : ' ' + timezone)
  );
}
