// Interface text shared by components, in English and Bahasa Melayu.
// Page-specific long content lives in each view (src/views/). Data (prices, codes, status) is never translated here.
import type { Lang } from './routes';

const en = {
  nav: {
    home: 'Home', maids: 'Find a Maid', indonesian: 'Indonesian Maid', filipino: 'Filipino Maid',
    services: 'Our Services', packages: 'Packages', about: 'About Us', contact: 'Contact',
    menu: 'Menu', main: 'Main', skip: 'Skip to content', switchTo: 'Baca dalam Bahasa Melayu', language: 'Language',
  },
  crumb: {
    home: 'Home', maids: 'Find a Maid', indonesian: 'Indonesian Maids', filipino: 'Filipino Maids', services: 'Services',
    process: 'Maid Hiring Process', packages: 'Maid Packages', about: 'About Us', contact: 'Contact', faq: 'FAQ', blog: 'Blog', privacy: 'Privacy Policy',
  },
  btn: {
    whatsappUs: 'WhatsApp Us', whatsapp: 'WhatsApp', whatsappConsultant: 'WhatsApp Our Consultant', browseMaids: 'Browse Available Maids',
    viewProfile: 'View Biodata', requestInterview: 'Request Interview', call: 'Call', learnMore: 'Learn more', readGuide: 'Read guide',
    enquire: 'Enquire', askAbout: 'Ask about', downloadBiodata: 'Download biodata (PDF)', seeProfiles: 'See profiles',
    allQuestions: 'See all questions', allBiodata: 'View all maid biodata', requestBiodata: 'Request biodata', toDirectory: 'Go to maid directory',
    enquirePackage: 'Enquire about', home: 'Go to homepage', aboutUs: 'About us', contactUs: 'Contact us', directions: 'Get directions', openMaps: 'Open in Google Maps',
  },
  status: { available: 'Available', 'interview-pending': 'Interview Pending', reserved: 'Reserved', processing: 'Processing', placed: 'Placed', unavailable: 'Unavailable', withdrawn: 'Withdrawn' },
  nationality: { indonesian: 'Indonesian', filipino: 'Filipino' },
  skill: { childcare: 'Childcare', newborn: 'Newborn care', elderlyCare: 'Elderly care', cooking: 'Cooking', housekeeping: 'Housekeeping', petCare: 'Pet care' },
  level: { experienced: 'Experienced', 'some-experience': 'Some experience', 'willing-to-learn': 'Willing to learn', none: '' },
  langLevel: { basic: 'basic', conversational: 'conversational', fluent: 'fluent', native: 'native' },
  card: {
    age: 'Age', experience: 'Experience', religion: 'Religion', newHelper: 'New helper', notStated: 'Not stated', years: (n: number) => `${n} yr${n === 1 ? '' : 's'}`,
    overseas: 'overseas', updated: 'Status updated', photoOnRequest: 'Photo available on request', demo: 'DEMO – not a real candidate', review: 'LOCAL REVIEW – NOT PUBLISHED', experienceIn: 'Experience in',
  },
  dir: {
    filterLabel: 'Filter maid profiles', searchCode: 'Search reference code', nationality: 'Nationality', all: 'All', experience: 'Experience',
    any: 'Any', yearsPlus: (n: number) => `${n}+ years`, availability: 'Availability', allStatuses: 'All statuses', experienceWith: 'Experience with',
    clear: 'Clear filters', profile: 'profile', profiles: 'profiles', pageOf: (p: number, n: number) => `page ${p} of ${n}`,
    pagesLabel: 'Profile pages', prev: '‹ Prev', next: 'Next ›', prevLabel: 'Previous page', nextLabel: 'Next page', pageLabel: 'Page',
    emptyTitle: 'New biodata are being prepared',
    emptyText: 'We only publish profiles after the candidate has agreed to it, so the list may be short or empty. Our consultant can share suitable biodata directly, based on your household’s needs.',
    emptyBtn: 'Ask for current biodata',
    allAvailable: 'View All Available Maids',
    noMatchTitle: 'No profiles match these filters',
    noMatchText: 'Try removing a filter, or tell us what you need. We may have suitable candidates who are not listed online yet.',
    availabilityNote: 'Availability shown is the status recorded by our team on the date displayed on each profile. It is not real-time. Please contact us to confirm before making plans. Not every candidate is listed online, so ask us if you do not see a suitable match.',
  },
  profile: {
    helper: 'domestic helper', reference: 'Maid reference', details: 'Candidate details', code: 'Reference code', nationality: 'Nationality',
    maritalStatus: 'Marital status', workExperience: 'Work experience', includingOverseas: '(including overseas)', interview: 'Interview',
    skills: 'Skills and responsibilities', area: 'Area', levelCol: 'Level', history: 'Employment history summary', country: 'Country',
    duration: 'Duration', duties: 'Main duties', languages: 'Languages', recorded: (d: string) => `Status recorded on ${d}. Please contact us to confirm current availability.`,
    declared: 'Skills and experience are as declared by the candidate and recorded by our team. We encourage every employer to confirm suitability during the interview. Personal documents are never published online.',
    others: (nat: string) => `Other available ${nat.toLowerCase()} helpers`, allOf: (nat: string) => `All ${nat.toLowerCase()} maid profiles`,
    summaryInEnglish: '',
    photoAlt: (code: string) => `Photo of domestic helper ${code}`,
  },
  pkg: {
    chooseNationality: 'Choose helper nationality', helper: 'helper', referencePrice: 'reference price*', quote: 'Request a quotation',
    pending: 'Inclusions and terms for this package are confirmed by our consultant with your quotation.', reviewed: 'Prices last reviewed',
  },
  process: {
    note: 'Processing time varies with documentation, government and embassy approvals, travel arrangements and other requirements. Timelines we share are estimates, not guarantees.',
    step: 'Step',
    steps: [
      { title: 'Tell us your requirements', text: 'Share who needs care, the main duties, your preferred nationality and language, and any household considerations.', more: 'A short WhatsApp or phone conversation is enough to start. We ask about the ages of children or elderly family members, cooking expectations, the size of your home, pets, and religious or dietary needs, so that we only recommend suitable candidates.' },
      { title: 'Review suitable maid biodata', text: 'We share biodata of candidates whose experience and skills fit your needs.', more: 'Each biodata summarises the candidate’s work experience, skills and languages. Ask us about anything that is unclear — we would rather you choose carefully than quickly.' },
      { title: 'Arrange an interview', text: 'Speak with your shortlisted candidate, usually by video call, before you decide.', more: 'We help schedule the interview and can suggest questions. If the candidate is not the right fit, we continue the search with you.' },
      { title: 'Complete recruitment documentation', text: 'We guide you through the employment contract and the documents your application needs.', more: 'You receive a checklist for your specific case. Requirements depend on the helper’s nationality and the current rules of the Malaysian authorities and the source country.' },
      { title: 'Process applications and approvals', text: 'Your application is submitted to the relevant authorities and followed up by our team.', more: 'Processing times depend on government and embassy approvals and on how quickly documents are completed. We keep you updated, but no agency can guarantee approval or a specific date.' },
      { title: 'Arrival, medical screening and orientation', text: 'After arrival, the helper completes her FOMEMA medical examination and an orientation.', more: 'Travel is arranged once approvals are in place. The orientation covers household expectations and practical working arrangements before she joins your family.' },
      { title: 'Handover and follow-up', text: 'We hand over your helper and stay available for questions after placement.', more: 'After-placement assistance includes guidance on settling in, and later on permit and contract renewal. Replacement terms depend on your package and service agreement.' },
    ],
  },
  form: {
    name: 'Name', phone: 'Contact number', phonePh: 'e.g. 012-345 6789', nationality: 'Preferred maid nationality', noPref: 'No preference yet',
    indonesian: 'Indonesian', filipino: 'Filipino', need: 'Main household requirement', choose: 'Please choose',
    needs: ['Childcare', 'Elderly care', 'Housekeeping', 'Cooking', 'General domestic help'],
    method: 'Preferred contact method', methodWa: 'WhatsApp', methodCall: 'Phone call', message: 'Message',
    messagePh: 'e.g. Looking for a helper with newborn care experience, from March.', honeypot: 'Leave this field empty',
    consentA: 'I agree that Final Choice may use these details to respond to my enquiry, as described in the', privacy: 'privacy policy',
    submitWa: 'Send enquiry via WhatsApp', submit: 'Send enquiry',
    hintWa: 'This opens WhatsApp with your details filled in. Press Send in WhatsApp to reach our consultant.', hint: 'Your enquiry is sent securely to our team.',
    errName: 'Please enter your name.', errPhone: 'Please enter a valid contact number.', errConsent: 'Please tick to agree before sending.',
    opened: 'WhatsApp has opened with your details. Please press Send in WhatsApp to reach our consultant.',
    sending: 'Sending…', received: 'Thank you. Your enquiry has been received and our consultant will contact you.', failed: 'Sorry, the enquiry could not be sent. Please WhatsApp us instead.',
    msgIntro: 'Hi Final Choice, I would like to enquire about hiring a domestic helper.', lName: 'Name', lContact: 'Contact', lNat: 'Preferred nationality',
    lNeed: 'Main requirement', lMethod: 'Preferred contact', lMsg: 'Message',
  },
  cta: {
    title: 'Talk to a consultant about your household',
    text: 'Tell us what your family needs. We will recommend suitable helpers and explain the next steps, costs and documents.',
  },
  footer: {
    findMaid: 'Find a Maid', services: 'Services', company: 'Company', contact: 'Contact',
    allBiodata: 'All maid biodata', indonesian: 'Indonesian maids', filipino: 'Filipino maids', packages: 'Maid packages', process: 'Hiring process',
    childcare: 'Childcare maid', elderly: 'Elderly care maid', housekeeping: 'Housekeeping maid', renewal: 'Permit & contract renewal', allServices: 'All services',
    about: 'About us', faq: 'FAQ', guides: 'Employer guides', contactLink: 'Contact', privacy: 'Privacy policy',
    companyNo: 'Company No.', licence: 'Private Employment Agency Licence', rights: 'All rights reserved.',
    disclaimer: 'Approval times are set by the relevant authorities and cannot be guaranteed by any agency.', onSocial: (s: string) => `Final Choice on ${s}`,
  },
  hours: { 'Monday – Friday': 'Monday – Friday', Saturday: 'Saturday' } as Record<string, string>,
  wa: {
    home: 'Hi Final Choice, I would like to enquire about hiring a domestic helper in Malaysia.',
    indonesian: 'Hi Final Choice, I am interested in hiring an Indonesian domestic helper. Can you assist me?',
    filipino: 'Hi Final Choice, I am interested in hiring a Filipino domestic helper. Can you assist me?',
    profile: (code: string) => `Hi Final Choice, I would like to enquire about maid reference ${code}.`,
    interview: (code: string) => `Hi Final Choice, I would like to request an interview with maid reference ${code}.`,
    package: (tier: string, nat: string) => `Hi Final Choice, I would like a quotation for the ${tier} package (${nat} domestic helper).`,
    service: (name: string) => `Hi Final Choice, I would like to enquire about ${name}.`,
    renewal: 'Hi Final Choice, I would like to enquire about renewing my maid’s work permit / contract.',
    biodata: 'Hi Final Choice, please share suitable domestic helper biodata for my family.',
    float: 'Chat with Final Choice on WhatsApp', floatLabel: 'WhatsApp us',
  },
  blog: { guide: 'Employer guide', by: (b: string) => `By ${b} consultants`, published: 'Published', updated: 'Updated', talk: 'Talk to a consultant',
    talkText: 'Tell us what your household needs and we will recommend suitable helpers.', related: 'Related',
    disclaimer: 'This guide gives general information for Malaysian employers. Government requirements change from time to time — our consultant will confirm the current requirements for your application.' },
};

type Dict = typeof en;

const ms: Dict = {
  nav: {
    home: 'Utama', maids: 'Cari Pembantu', indonesian: 'Indonesia', filipino: 'Filipina',
    services: 'Perkhidmatan', packages: 'Pakej', about: 'Tentang Kami', contact: 'Hubungi',
    menu: 'Menu', main: 'Utama', skip: 'Langkau ke kandungan', switchTo: 'Read in English', language: 'Bahasa',
  },
  crumb: {
    home: 'Utama', maids: 'Cari Pembantu Rumah', indonesian: 'Pembantu Rumah Indonesia', filipino: 'Pembantu Rumah Filipina', services: 'Perkhidmatan',
    process: 'Proses Pengambilan', packages: 'Pakej Pembantu Rumah', about: 'Tentang Kami', contact: 'Hubungi Kami', faq: 'Soalan Lazim', blog: 'Blog', privacy: 'Dasar Privasi',
  },
  btn: {
    whatsappUs: 'WhatsApp Kami', whatsapp: 'WhatsApp', whatsappConsultant: 'WhatsApp Perunding Kami', browseMaids: 'Lihat Pembantu Rumah',
    viewProfile: 'Lihat Biodata', requestInterview: 'Mohon Temu Duga', call: 'Hubungi', learnMore: 'Ketahui lanjut', readGuide: 'Baca panduan',
    enquire: 'Tanya', askAbout: 'Tanya tentang', downloadBiodata: 'Muat turun biodata (PDF)', seeProfiles: 'Lihat profil',
    allQuestions: 'Lihat semua soalan', allBiodata: 'Lihat semua biodata', requestBiodata: 'Minta biodata', toDirectory: 'Ke direktori pembantu rumah',
    enquirePackage: 'Tanya tentang', home: 'Ke laman utama', aboutUs: 'Tentang kami', contactUs: 'Hubungi kami', directions: 'Dapatkan arah', openMaps: 'Buka di Google Maps',
  },
  status: { available: 'Tersedia', 'interview-pending': 'Menunggu Temu Duga', reserved: 'Telah Ditempah', processing: 'Dalam Proses', placed: 'Telah Ditempatkan', unavailable: 'Tidak Tersedia', withdrawn: 'Ditarik Balik' },
  nationality: { indonesian: 'Indonesia', filipino: 'Filipina' },
  skill: { childcare: 'Jaga anak', newborn: 'Jaga bayi', elderlyCare: 'Jaga warga emas', cooking: 'Memasak', housekeeping: 'Kerja rumah', petCare: 'Jaga haiwan peliharaan' },
  level: { experienced: 'Berpengalaman', 'some-experience': 'Ada sedikit pengalaman', 'willing-to-learn': 'Sanggup belajar', none: '' },
  langLevel: { basic: 'asas', conversational: 'boleh bertutur', fluent: 'fasih', native: 'bahasa ibunda' },
  card: {
    age: 'Umur', experience: 'Pengalaman', religion: 'Agama', newHelper: 'Pembantu baharu', notStated: 'Tidak dinyatakan', years: (n: number) => `${n} tahun`,
    overseas: 'luar negara', updated: 'Status dikemas kini', photoOnRequest: 'Gambar boleh diberi atas permintaan', demo: 'DEMO – bukan calon sebenar', review: 'SEMAKAN DALAMAN – BELUM DISIARKAN', experienceIn: 'Pengalaman dalam',
  },
  dir: {
    filterLabel: 'Tapis profil pembantu rumah', searchCode: 'Cari kod rujukan', nationality: 'Warganegara', all: 'Semua', experience: 'Pengalaman',
    any: 'Mana-mana', yearsPlus: (n: number) => `${n} tahun ke atas`, availability: 'Status', allStatuses: 'Semua status', experienceWith: 'Pengalaman dalam',
    clear: 'Kosongkan penapis', profile: 'profil', profiles: 'profil', pageOf: (p: number, n: number) => `halaman ${p} daripada ${n}`,
    pagesLabel: 'Halaman profil', prev: '‹ Sebelum', next: 'Seterusnya ›', prevLabel: 'Halaman sebelumnya', nextLabel: 'Halaman seterusnya', pageLabel: 'Halaman',
    emptyTitle: 'Biodata baharu sedang disediakan',
    emptyText: 'Kami hanya menyiarkan profil selepas calon memberi persetujuan, jadi senarai ini mungkin pendek atau kosong. Perunding kami boleh berkongsi biodata yang sesuai terus kepada anda, mengikut keperluan keluarga anda.',
    emptyBtn: 'Minta biodata terkini',
    allAvailable: 'Lihat Semua Pembantu Tersedia',
    noMatchTitle: 'Tiada profil yang sepadan dengan penapis ini',
    noMatchText: 'Cuba buang satu penapis, atau beritahu kami keperluan anda. Mungkin ada calon sesuai yang belum disenaraikan dalam talian.',
    availabilityNote: 'Status yang dipaparkan ialah status yang direkodkan oleh pasukan kami pada tarikh yang tertera pada setiap profil, dan bukan masa nyata. Sila hubungi kami untuk pengesahan sebelum membuat perancangan. Bukan semua calon disenaraikan dalam talian, jadi tanyakan kami jika anda tidak menemui calon yang sesuai.',
  },
  profile: {
    helper: 'pembantu rumah', reference: 'Rujukan pembantu rumah', details: 'Maklumat calon', code: 'Kod rujukan', nationality: 'Warganegara',
    maritalStatus: 'Taraf perkahwinan', workExperience: 'Pengalaman kerja', includingOverseas: '(termasuk luar negara)', interview: 'Temu duga',
    skills: 'Kemahiran dan tugas', area: 'Bidang', levelCol: 'Tahap', history: 'Ringkasan sejarah pekerjaan', country: 'Negara',
    duration: 'Tempoh', duties: 'Tugas utama', languages: 'Bahasa', recorded: (d: string) => `Status direkodkan pada ${d}. Sila hubungi kami untuk mengesahkan status terkini.`,
    declared: 'Kemahiran dan pengalaman adalah seperti yang dinyatakan oleh calon dan direkodkan oleh pasukan kami. Kami menggalakkan setiap majikan mengesahkan kesesuaian semasa temu duga. Dokumen peribadi tidak sekali-kali disiarkan dalam talian.',
    others: (nat: string) => `Pembantu rumah ${nat} lain yang tersedia`, allOf: (nat: string) => `Semua profil pembantu rumah ${nat}`,
    summaryInEnglish: 'Ringkasan ini disediakan dalam Bahasa Inggeris.',
    photoAlt: (code: string) => `Gambar pembantu rumah ${code}`,
  },
  pkg: {
    chooseNationality: 'Pilih warganegara pembantu', helper: 'pembantu', referencePrice: 'harga rujukan*', quote: 'Minta sebut harga',
    pending: 'Kandungan dan terma pakej ini akan disahkan oleh perunding kami bersama sebut harga anda.', reviewed: 'Harga terakhir disemak',
  },
  process: {
    note: 'Tempoh pemprosesan bergantung pada dokumen, kelulusan kerajaan dan kedutaan, urusan perjalanan serta keperluan lain. Anggaran masa yang kami berikan bukan jaminan.',
    step: 'Langkah',
    steps: [
      { title: 'Beritahu keperluan anda', text: 'Kongsikan siapa yang perlu dijaga, tugas utama, warganegara dan bahasa pilihan, serta keperluan khas keluarga anda.', more: 'Perbualan ringkas melalui WhatsApp atau telefon sudah memadai untuk bermula. Kami akan bertanya tentang umur anak atau ahli keluarga warga emas, jangkaan memasak, saiz rumah, haiwan peliharaan, serta keperluan agama atau pemakanan, supaya kami hanya mencadangkan calon yang sesuai.' },
      { title: 'Semak biodata yang sesuai', text: 'Kami berkongsi biodata calon yang pengalaman dan kemahirannya sepadan dengan keperluan anda.', more: 'Setiap biodata meringkaskan pengalaman kerja, kemahiran dan bahasa calon. Tanya kami jika ada yang kurang jelas — kami lebih mengutamakan pilihan yang tepat berbanding pilihan yang tergesa-gesa.' },
      { title: 'Atur temu duga', text: 'Berbual dengan calon pilihan anda, biasanya melalui panggilan video, sebelum membuat keputusan.', more: 'Kami membantu mengatur temu duga dan boleh mencadangkan soalan. Jika calon kurang sesuai, kami akan teruskan pencarian bersama anda.' },
      { title: 'Lengkapkan dokumen pengambilan', text: 'Kami membimbing anda menyediakan kontrak pekerjaan dan dokumen yang diperlukan.', more: 'Anda akan menerima senarai semak untuk kes anda. Keperluan bergantung pada warganegara pembantu serta peraturan semasa pihak berkuasa Malaysia dan negara asal.' },
      { title: 'Proses permohonan dan kelulusan', text: 'Permohonan anda dihantar kepada pihak berkuasa berkaitan dan dipantau oleh pasukan kami.', more: 'Tempoh pemprosesan bergantung pada kelulusan kerajaan dan kedutaan serta kelengkapan dokumen. Kami akan sentiasa memaklumkan perkembangan, tetapi tiada agensi yang boleh menjamin kelulusan atau tarikh tertentu.' },
      { title: 'Ketibaan, pemeriksaan perubatan dan orientasi', text: 'Selepas tiba, pembantu menjalani pemeriksaan perubatan FOMEMA dan sesi orientasi.', more: 'Perjalanan diatur sebaik sahaja kelulusan diperoleh. Orientasi merangkumi jangkaan isi rumah dan cara kerja praktikal sebelum dia mula bersama keluarga anda.' },
      { title: 'Penyerahan dan susulan', text: 'Kami menyerahkan pembantu rumah anda dan sentiasa sedia membantu selepas penempatan.', more: 'Bantuan selepas penempatan termasuk panduan menyesuaikan diri, serta pembaharuan permit dan kontrak kemudian. Terma penggantian bergantung pada pakej dan perjanjian perkhidmatan anda.' },
    ],
  },
  form: {
    name: 'Nama', phone: 'Nombor telefon', phonePh: 'cth. 012-345 6789', nationality: 'Warganegara pembantu pilihan', noPref: 'Belum ada pilihan',
    indonesian: 'Indonesia', filipino: 'Filipina', need: 'Keperluan utama', choose: 'Sila pilih',
    needs: ['Jaga anak', 'Jaga warga emas', 'Kerja rumah', 'Memasak', 'Bantuan rumah am'],
    method: 'Cara dihubungi', methodWa: 'WhatsApp', methodCall: 'Panggilan telefon', message: 'Mesej',
    messagePh: 'cth. Mencari pembantu yang berpengalaman menjaga bayi, mulai bulan Mac.', honeypot: 'Biarkan ruangan ini kosong',
    consentA: 'Saya bersetuju Final Choice menggunakan maklumat ini untuk menjawab pertanyaan saya, seperti yang diterangkan dalam', privacy: 'dasar privasi',
    submitWa: 'Hantar pertanyaan melalui WhatsApp', submit: 'Hantar pertanyaan',
    hintWa: 'WhatsApp akan dibuka dengan maklumat anda. Tekan Hantar dalam WhatsApp untuk menghubungi perunding kami.', hint: 'Pertanyaan anda dihantar dengan selamat kepada pasukan kami.',
    errName: 'Sila masukkan nama anda.', errPhone: 'Sila masukkan nombor telefon yang sah.', errConsent: 'Sila tanda persetujuan sebelum menghantar.',
    opened: 'WhatsApp telah dibuka dengan maklumat anda. Sila tekan Hantar dalam WhatsApp untuk menghubungi perunding kami.',
    sending: 'Sedang dihantar…', received: 'Terima kasih. Pertanyaan anda telah diterima dan perunding kami akan menghubungi anda.', failed: 'Maaf, pertanyaan tidak dapat dihantar. Sila WhatsApp kami.',
    msgIntro: 'Hai Final Choice, saya ingin bertanya tentang pengambilan pembantu rumah.', lName: 'Nama', lContact: 'No. telefon', lNat: 'Warganegara pilihan',
    lNeed: 'Keperluan utama', lMethod: 'Cara dihubungi', lMsg: 'Mesej',
  },
  cta: {
    title: 'Berbincang dengan perunding tentang keperluan keluarga anda',
    text: 'Beritahu kami keperluan keluarga anda. Kami akan mencadangkan pembantu rumah yang sesuai dan menerangkan langkah seterusnya, kos dan dokumen.',
  },
  footer: {
    findMaid: 'Cari Pembantu', services: 'Perkhidmatan', company: 'Syarikat', contact: 'Hubungi',
    allBiodata: 'Semua biodata', indonesian: 'Pembantu rumah Indonesia', filipino: 'Pembantu rumah Filipina', packages: 'Pakej pembantu rumah', process: 'Proses pengambilan',
    childcare: 'Pembantu jaga anak', elderly: 'Pembantu jaga orang tua', housekeeping: 'Pembantu kerja rumah', renewal: 'Pembaharuan permit & kontrak', allServices: 'Semua perkhidmatan',
    about: 'Tentang kami', faq: 'Soalan lazim', guides: 'Panduan majikan', contactLink: 'Hubungi kami', privacy: 'Dasar privasi',
    companyNo: 'No. Syarikat', licence: 'Lesen Agensi Pekerjaan Swasta', rights: 'Hak cipta terpelihara.',
    disclaimer: 'Tempoh kelulusan ditentukan oleh pihak berkuasa berkaitan dan tidak boleh dijamin oleh mana-mana agensi.', onSocial: (s: string) => `Final Choice di ${s}`,
  },
  hours: { 'Monday – Friday': 'Isnin – Jumaat', Saturday: 'Sabtu' },
  wa: {
    home: 'Hai Final Choice, saya ingin bertanya tentang pengambilan pembantu rumah di Malaysia.',
    indonesian: 'Hai Final Choice, saya berminat untuk mendapatkan pembantu rumah Indonesia. Boleh pihak tuan/puan membantu saya?',
    filipino: 'Hai Final Choice, saya berminat untuk mendapatkan pembantu rumah Filipina. Boleh pihak tuan/puan membantu saya?',
    profile: (code: string) => `Hai Final Choice, saya ingin bertanya tentang pembantu rumah rujukan ${code}.`,
    interview: (code: string) => `Hai Final Choice, saya ingin memohon temu duga dengan pembantu rumah rujukan ${code}.`,
    package: (tier: string, nat: string) => `Hai Final Choice, saya ingin mendapatkan sebut harga pakej ${tier} (pembantu rumah ${nat}).`,
    service: (name: string) => `Hai Final Choice, saya ingin bertanya tentang ${name}.`,
    renewal: 'Hai Final Choice, saya ingin bertanya tentang pembaharuan permit kerja / kontrak pembantu rumah saya.',
    biodata: 'Hai Final Choice, boleh kongsikan biodata pembantu rumah yang sesuai untuk keluarga saya?',
    float: 'Berbual dengan Final Choice melalui WhatsApp', floatLabel: 'WhatsApp kami',
  },
  blog: { guide: 'Panduan majikan', by: (b: string) => `Oleh perunding ${b}`, published: 'Diterbitkan', updated: 'Dikemas kini', talk: 'Berbincang dengan perunding',
    talkText: 'Beritahu kami keperluan keluarga anda dan kami akan mencadangkan pembantu rumah yang sesuai.', related: 'Berkaitan',
    disclaimer: 'Panduan ini memberi maklumat umum untuk majikan di Malaysia. Keperluan kerajaan berubah dari semasa ke semasa — perunding kami akan mengesahkan keperluan terkini untuk permohonan anda.' },
};

export const UI: Record<Lang, Dict> = { en, ms };
export const t = (lang: Lang) => UI[lang];

export function formatDate(d: Date, lang: Lang): string {
  return d.toLocaleDateString(lang === 'ms' ? 'ms-MY' : 'en-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' });
}
export function formatLongDate(d: Date, lang: Lang): string {
  return d.toLocaleDateString(lang === 'ms' ? 'ms-MY' : 'en-MY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' });
}
