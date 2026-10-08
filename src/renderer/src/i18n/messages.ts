// App-owned English copy is the stable key. Missing translations fall back to English.
export const messages: Record<string, { fr: string; ar: string }> = {
  'The destination PDF is already open in Illustrator. Close it or choose another filename.': {
    fr: 'Le PDF de destination est déjà ouvert dans Illustrator. Fermez-le ou choisissez un autre nom de fichier.',
    ar: 'ملف PDF المقصود مفتوح بالفعل في Illustrator. أغلقه أو اختر اسم ملف آخر.'
  },
  'Illustrator could not verify the saved PDF. Export it again before using it for production.': {
    fr: 'Illustrator n’a pas pu vérifier le PDF enregistré. Réexportez-le avant de l’utiliser en production.',
    ar: 'تعذر على Illustrator التحقق من ملف PDF المحفوظ. أعد تصديره قبل استخدامه في الإنتاج.'
  },
  'Open Adobe Illustrator, close its startup dialogs, then export again.': {
    fr: 'Ouvrez Adobe Illustrator, fermez les fenêtres de démarrage, puis relancez l’export.',
    ar: 'افتح Adobe Illustrator وأغلق نوافذ بدء التشغيل، ثم أعد التصدير.'
  },
  'Illustrator is waiting for a dialog. Switch to Illustrator, close the FineCut/Coat setup or other open dialog, then export again.':
    {
      fr: 'Illustrator attend une réponse dans une fenêtre. Passez dans Illustrator, fermez la configuration FineCut/Coat ou toute autre fenêtre ouverte, puis relancez l’export.',
      ar: 'ينتظر Illustrator نافذة حوار. انتقل إلى Illustrator وأغلق إعداد FineCut/Coat أو أي نافذة حوار مفتوحة، ثم أعد التصدير.'
    },
  'Illustrator is busy with another operation. Wait for it to finish, then export again.': {
    fr: 'Illustrator exécute une autre opération. Attendez la fin, puis relancez l’export.',
    ar: 'Illustrator مشغول بعملية أخرى. انتظر حتى تنتهي، ثم أعد التصدير.'
  },
  'Illustrator did not finish this export in time. Check Illustrator and its FineCut/Coat dialogs before trying again.':
    {
      fr: 'Illustrator n’a pas terminé l’export à temps. Vérifiez Illustrator et les fenêtres FineCut/Coat avant de réessayer.',
      ar: 'لم يكمل Illustrator التصدير في الوقت المحدد. تحقق من Illustrator ونوافذ FineCut/Coat قبل إعادة المحاولة.'
    },
  'The Illustrator automation connection is unavailable. Open Illustrator once, then retry.': {
    fr: 'La connexion d’automatisation Illustrator est indisponible. Ouvrez Illustrator, puis réessayez.',
    ar: 'اتصال أتمتة Illustrator غير متاح. افتح Illustrator مرة واحدة، ثم أعد المحاولة.'
  },
  'Illustrator could not export this sheet. Check its open dialogs and try again. Export diagnostics were kept in the cutting job folder.':
    {
      fr: 'Illustrator n’a pas pu exporter cette feuille. Vérifiez ses fenêtres ouvertes et réessayez. Les diagnostics sont conservés dans le dossier du travail de découpe.',
      ar: 'تعذر على Illustrator تصدير هذه الورقة. تحقق من نوافذ الحوار المفتوحة وأعد المحاولة. تم حفظ تشخيص التصدير في مجلد مهمة القص.'
    },
  'The PDF could not be saved to this folder. Choose a writable local folder and try again.': {
    fr: 'Le PDF n’a pas pu être enregistré dans ce dossier. Choisissez un dossier local accessible en écriture et réessayez.',
    ar: 'تعذر حفظ PDF في هذا المجلد. اختر مجلدًا محليًا يسمح بالكتابة وأعد المحاولة.'
  },
  'There is not enough free space to save the PDF. Free some disk space or choose another drive.': {
    fr: 'L’espace disponible est insuffisant pour enregistrer le PDF. Libérez de l’espace ou choisissez un autre disque.',
    ar: 'لا توجد مساحة خالية كافية لحفظ PDF. حرر بعض المساحة أو اختر قرصًا آخر.'
  },
  'PDF export stopped.': { fr: 'L’export PDF s’est arrêté.', ar: 'توقف تصدير PDF.' },
  'Move contour left': { fr: 'Déplacer le contour à gauche', ar: 'تحريك خط القص لليسار' },
  'Move contour right': { fr: 'Déplacer le contour à droite', ar: 'تحريك خط القص لليمين' },
  'Move contour up': { fr: 'Déplacer le contour vers le haut', ar: 'تحريك خط القص للأعلى' },
  'Move contour down': { fr: 'Déplacer le contour vers le bas', ar: 'تحريك خط القص للأسفل' },
  'Edge close-up location': { fr: 'Bord à examiner', ar: 'موضع معاينة الحافة' },
  'Close-up width mm': { fr: 'Largeur du détail en mm', ar: 'عرض المعاينة بالملم' },
  'Cut edge close-up': { fr: 'Détail du bord de découpe', ar: 'معاينة مكبرة لحافة القص' },
  'Contour adjustment step': { fr: 'Pas de réglage du contour', ar: 'خطوة تعديل خط القص' },
  'Move cut contour only': { fr: 'Déplacer uniquement le contour', ar: 'تحريك خط القص فقط' },
  'Trim 0.2 mm': { fr: 'Rogner de 0,2 mm', ar: 'قص للداخل بمقدار 0.2 ملم' },
  'Match mask · no gap': {
    fr: 'Aligner sur le masque · sans écart',
    ar: 'مطابقة القناع · بدون فراغ'
  },
  'Checkerboard shows unprinted area': {
    fr: 'Le damier indique la zone non imprimée',
    ar: 'المربعات توضح المساحة غير المطبوعة'
  },
  '{value} mm outward on each side adds a border.': {
    fr: '{value} mm vers l’extérieur de chaque côté ajoute une bordure.',
    ar: 'إضافة {value} ملم للخارج من كل جانب تنشئ هامشًا.'
  },
  '{value} mm inward on each side trims inside the edge.': {
    fr: '{value} mm vers l’intérieur de chaque côté rogne le bord.',
    ar: 'قص {value} ملم للداخل من كل جانب يزيل هامش الحافة.'
  },
  'Zero adds no extra border to this contour.': {
    fr: 'Zéro n’ajoute aucune bordure à ce contour.',
    ar: 'القيمة صفر لا تضيف أي هامش إلى خط القص.'
  },
  'Custom paths are resized at their bounds; this is not a uniform path offset.': {
    fr: 'Les tracés personnalisés sont redimensionnés selon leurs limites ; le décalage n’est pas uniforme le long du tracé.',
    ar: 'تتغير أحجام المسارات المخصصة حسب حدودها؛ هذه ليست إزاحة موحدة على طول المسار.'
  },
  'Magenta is the cut line. White space inside the image needs a tighter mask in Prepare artwork. Use an inward trim or artwork bleed to cover small cutting shifts.':
    {
      fr: 'Le magenta indique le contour de découpe. Pour supprimer le blanc à l’intérieur de l’image, resserrez le masque dans Préparer le visuel. Un rognage vers l’intérieur ou un fond perdu compense les petits décalages de coupe.',
      ar: 'اللون الأرجواني هو خط القص. تتطلب المساحة البيضاء داخل الصورة قناعًا أضيق في إعداد التصميم. استخدم القص للداخل أو امتداد الطباعة لتغطية الانزياحات الصغيرة في القص.'
    },
  'The Sticker Maker border is already built into this path. Zero adjustment keeps that border; change it in Sticker Maker to retrace the edge.':
    {
      fr: 'La bordure du Créateur de stickers est déjà intégrée au tracé. Le réglage zéro la conserve ; modifiez-la dans le Créateur de stickers pour recalculer le bord.',
      ar: 'هامش صانع الملصقات مدمج بالفعل في هذا المسار. التعديل صفر يحافظ عليه؛ غيّره في صانع الملصقات لإعادة رسم الحافة.'
    },
  'Expand pages': { fr: 'Développer les pages', ar: 'توسيع الصفحات' },
  'Collapse pages': { fr: 'Réduire les pages', ar: 'طي الصفحات' },
  'Booklet pages': { fr: 'Pages du livret', ar: 'صفحات الكتيب' },
  'Page actions': { fr: 'Actions des pages', ar: 'إجراءات الصفحات' },
  'Selected page': { fr: 'Page sélectionnée', ar: 'الصفحة المحددة' },
  'No pages loaded': { fr: 'Aucune page chargée', ar: 'لا توجد صفحات محملة' },
  'Select page': { fr: 'Sélectionner la page', ar: 'تحديد الصفحة' },
  'Reorder page': { fr: 'Réordonner la page', ar: 'إعادة ترتيب الصفحة' },
  'Delete page': { fr: 'Supprimer la page', ar: 'حذف الصفحة' },
  'Change page color': { fr: 'Changer la couleur de la page', ar: 'تغيير لون الصفحة' },
  'Add blank page': { fr: 'Ajouter une page vierge', ar: 'إضافة صفحة فارغة' },
  'Reset to original order': { fr: 'Rétablir l’ordre initial', ar: 'استعادة الترتيب الأصلي' },
  'Remove blanks and reset': {
    fr: 'Retirer les pages vierges et rétablir',
    ar: 'إزالة الصفحات الفارغة واستعادة الترتيب'
  },
  'Loading page…': { fr: 'Chargement de la page…', ar: 'جارٍ تحميل الصفحة…' },
  'Double-click to inspect page': {
    fr: 'Double-cliquez pour inspecter la page',
    ar: 'انقر مرتين لفحص الصفحة'
  },
  'Import a PDF or images using the toolbar above.': {
    fr: 'Importez un PDF ou des images avec la barre d’outils ci-dessus.',
    ar: 'استورد PDF أو صورًا باستخدام شريط الأدوات أعلاه.'
  },
  'Clear workspace?': { fr: 'Vider l’espace de travail ?', ar: 'إفراغ مساحة العمل؟' },
  'Remove the current artwork, pages, and canvas items? Tool settings and saved files are kept.': {
    fr: 'Supprimer les visuels, pages et éléments actuels du plan de travail ? Les réglages et les fichiers enregistrés sont conservés.',
    ar: 'هل تريد إزالة التصاميم والصفحات وعناصر مساحة العمل الحالية؟ يتم الاحتفاظ بإعدادات الأداة والملفات المحفوظة.'
  },
  'Checking for updates…': { fr: 'Recherche de mises à jour…', ar: 'جارٍ البحث عن تحديثات…' },
  'Installing update…': { fr: 'Installation de la mise à jour…', ar: 'جارٍ تثبيت التحديث…' },
  'Downloading update…': { fr: 'Téléchargement de la mise à jour…', ar: 'جارٍ تنزيل التحديث…' },
  'Cutting lines on front only (0.25 px)': {
    fr: 'Lignes de découpe au recto uniquement (0,25 px)',
    ar: 'خطوط القص على الوجه الأمامي فقط (0.25 بكسل)'
  },
  'Margins & cutting lines': {
    fr: 'Marges et lignes de découpe',
    ar: 'الهوامش وخطوط القص'
  },
  'Cutting lines across sheet (0.25 px)': {
    fr: 'Lignes de découpe sur toute la feuille (0,25 px)',
    ar: 'خطوط القص عبر الورقة (0.25 بكسل)'
  },
  'Cutting line color': {
    fr: 'Couleur des lignes de découpe',
    ar: 'لون خطوط القص'
  },
  'Vector artwork and embedded images are stored in the project.': {
    fr: 'Les illustrations vectorielles et les images incorporées sont enregistrées dans le projet.',
    ar: 'الرسومات المتجهة والصور المضمنة محفوظة في المشروع.'
  },
  'Could not import EPS. Check that Adobe Illustrator is installed and activated, close its dialogs, and use embedded images and installed or outlined fonts. You can also export the design as PDF.':
    {
      fr: 'Impossible d’importer l’EPS. Vérifiez qu’Adobe Illustrator est installé et activé, fermez ses boîtes de dialogue et utilisez des images incorporées et des polices installées ou vectorisées. Vous pouvez aussi exporter le dessin en PDF.',
      ar: 'تعذر استيراد EPS. تأكد من تثبيت Adobe Illustrator وتفعيله، وأغلق نوافذه الحوارية، واستخدم صورًا مضمنة وخطوطًا مثبتة أو محوّلة إلى مسارات. يمكنك أيضًا تصدير التصميم إلى PDF.'
    },
  'EPS import requires the desktop app and Adobe Illustrator. Export the EPS as PDF to import it here.':
    {
      fr: 'L’import EPS nécessite l’application de bureau et Adobe Illustrator. Exportez l’EPS en PDF pour l’importer ici.',
      ar: 'استيراد EPS يتطلب تطبيق سطح المكتب وAdobe Illustrator. صدّر EPS إلى PDF لاستيراده هنا.'
    },
  'This file is empty. Choose an AI, EPS, PDF, PNG, or JPG design.': {
    fr: 'Ce fichier est vide. Choisissez un dessin AI, EPS, PDF, PNG ou JPG.',
    ar: 'هذا الملف فارغ. اختر تصميمًا بصيغة AI أو EPS أو PDF أو PNG أو JPG.'
  },
  'Choose a design smaller than 30 MB.': {
    fr: 'Choisissez un dessin de moins de 30 Mo.',
    ar: 'اختر تصميمًا أصغر من 30 ميغابايت.'
  },
  'Choose an EPS design.': {
    fr: 'Choisissez un dessin EPS.',
    ar: 'اختر تصميم EPS.'
  },
  'This EPS file is empty.': {
    fr: 'Ce fichier EPS est vide.',
    ar: 'ملف EPS هذا فارغ.'
  },
  'This EPS file has an invalid preview header.': {
    fr: 'L’en-tête d’aperçu de ce fichier EPS est invalide.',
    ar: 'ترويسة المعاينة في ملف EPS غير صالحة.'
  },
  'This EPS file has an invalid PostScript section.': {
    fr: 'La section PostScript de ce fichier EPS est invalide.',
    ar: 'قسم PostScript في ملف EPS غير صالح.'
  },
  'This file is not a supported EPS design.': {
    fr: 'Ce fichier n’est pas un dessin EPS pris en charge.',
    ar: 'هذا الملف ليس تصميم EPS مدعومًا.'
  },
  'The EPS has no valid bounding box. Export it as PDF from the original design.': {
    fr: 'L’EPS n’a pas de cadre de dimensions valide. Exportez le dessin original en PDF.',
    ar: 'ملف EPS لا يحتوي على حدود أبعاد صالحة. صدّر التصميم الأصلي إلى PDF.'
  },
  'EPS import requires Adobe Illustrator. Use installed or outlined fonts.': {
    fr: 'L’import EPS nécessite Adobe Illustrator. Utilisez des polices installées ou vectorisées.',
    ar: 'استيراد EPS يتطلب Adobe Illustrator. استخدم خطوطًا مثبتة أو محوّلة إلى مسارات.'
  },
  'AI, EPS, PDF, PNG, JPG · up to 30 MB': {
    fr: 'AI, EPS, PDF, PNG, JPG · jusqu’à 30 Mo',
    ar: 'AI، EPS، PDF، PNG، JPG · حتى 30 ميغابايت'
  },
  'EPS converted to PDF': {
    fr: 'EPS converti en PDF',
    ar: 'EPS محوّل إلى PDF'
  },
  'EPS fonts embedded in the converted PDF.': {
    fr: 'Polices EPS incorporées dans le PDF converti.',
    ar: 'خطوط EPS مضمنة في ملف PDF المحوّل.'
  },
  'App language': {
    fr: 'Langue de l’application',
    ar: 'لغة التطبيق'
  },
  'Not saved yet': {
    fr: 'Pas encore enregistré',
    ar: 'لم يُحفظ بعد'
  },
  'Book Measurements': {
    fr: 'Dimensions du livre',
    ar: 'قياسات الكتاب'
  },
  'Spine Text': {
    fr: 'Texte du dos',
    ar: 'نص الكعب'
  },
  'Source PDF:': {
    fr: 'PDF source :',
    ar: 'PDF المصدر:'
  },
  'Source:': {
    fr: 'Source :',
    ar: 'المصدر:'
  },
  'Preflight:': {
    fr: 'Contrôle :',
    ar: 'الفحص:'
  },
  'Spine year:': {
    fr: 'Année sur le dos :',
    ar: 'سنة الكعب:'
  },
  'PDF ready': {
    fr: 'PDF prêt',
    ar: 'PDF جاهز'
  },
  'No PDF': {
    fr: 'Aucun PDF',
    ar: 'لا يوجد PDF'
  },
  'Not set': {
    fr: 'Non défini',
    ar: 'غير محدد'
  },
  warnings: {
    fr: 'avertissements',
    ar: 'تحذيرات'
  },
  errors: {
    fr: 'erreurs',
    ar: 'أخطاء'
  },
  notes: {
    fr: 'notes',
    ar: 'ملاحظات'
  },
  passed: {
    fr: 'validé',
    ar: 'تم الاجتياز'
  },
  'View options': {
    fr: 'Options d’affichage',
    ar: 'خيارات العرض'
  },
  'Preview zoom controls': {
    fr: 'Commandes de zoom',
    ar: 'أدوات تكبير المعاينة'
  },
  'Preview zoom': {
    fr: 'Zoom de l’aperçu',
    ar: 'تكبير المعاينة'
  },
  'Show at actual size': {
    fr: 'Afficher à taille réelle',
    ar: 'العرض بالحجم الفعلي'
  },
  'Show or hide binding and fold guides': {
    fr: 'Afficher ou masquer les guides de reliure et de pliage',
    ar: 'عرض أو إخفاء أدلة التجليد والطي'
  },
  'Show the area where text and important artwork stay safe': {
    fr: 'Afficher la zone sûre pour le texte et les visuels importants',
    ar: 'عرض المنطقة الآمنة للنص والتصاميم المهمة'
  },
  'Align artwork to nearby guides while dragging': {
    fr: 'Aligner le visuel sur les guides proches pendant le déplacement',
    ar: 'محاذاة التصميم إلى الأدلة القريبة أثناء السحب'
  },
  'Import back PDF': {
    fr: 'Importer le PDF arrière',
    ar: 'استيراد PDF الغلاف الخلفي'
  },
  'Upload a source PDF': {
    fr: 'Importer un PDF source',
    ar: 'رفع PDF المصدر'
  },
  'Next: book measurements': {
    fr: 'Suivant : dimensions du livre',
    ar: 'التالي: قياسات الكتاب'
  },
  'Next: spine text': {
    fr: 'Suivant : texte du dos',
    ar: 'التالي: نص الكعب'
  },
  'Next: export': {
    fr: 'Suivant : export',
    ar: 'التالي: التصدير'
  },
  'Start by uploading your mémoire PDF.': {
    fr: 'Commencez par importer le PDF de votre mémoire.',
    ar: 'ابدأ برفع PDF المذكرة.'
  },
  'Choose your cover pages, then continue to book measurements.': {
    fr: 'Choisissez vos pages de couverture, puis passez aux dimensions du livre.',
    ar: 'اختر صفحات الغلاف ثم تابع إلى قياسات الكتاب.'
  },
  'Check the physical book dimensions, then continue to spine text.': {
    fr: 'Vérifiez les dimensions du livre, puis passez au texte du dos.',
    ar: 'تحقق من قياسات الكتاب الفعلية ثم تابع إلى نص الكعب.'
  },
  'Review the spine text in the preview, then continue to export.': {
    fr: 'Vérifiez le texte du dos dans l’aperçu, puis passez à l’export.',
    ar: 'راجع نص الكعب في المعاينة ثم تابع إلى التصدير.'
  },
  'Review the production settings, then export your PDF or print.': {
    fr: 'Vérifiez les réglages de production, puis exportez votre PDF ou imprimez.',
    ar: 'راجع إعدادات الإنتاج ثم صدّر PDF أو اطبع.'
  },
  'Drop a PDF anywhere here for the front cover. Use the upload buttons to drop a book PDF or back cover.':
    {
      fr: 'Déposez ici un PDF pour la couverture avant. Utilisez les boutons pour importer le livre ou la couverture arrière.',
      ar: 'أفلت PDF هنا للغلاف الأمامي. استخدم أزرار الرفع لإضافة PDF الكتاب أو الغلاف الخلفي.'
    },
  'Upload a mémoire PDF to use page 1 as the front cover source.': {
    fr: 'Importez le PDF du mémoire pour utiliser sa première page en couverture avant.',
    ar: 'ارفع PDF المذكرة لاستخدام الصفحة الأولى مصدرًا للغلاف الأمامي.'
  },
  'Set the spine first, then confirm the printer sheet size.': {
    fr: 'Définissez le dos, puis confirmez la taille de feuille d’impression.',
    ar: 'اضبط الكعب أولًا ثم أكد حجم ورقة الطباعة.'
  },
  'Front and back files stay separate. Choose a page and Fit or Fill independently for each cover.':
    {
      fr: 'Les fichiers avant et arrière restent séparés. Choisissez la page et l’ajustement pour chaque couverture.',
      ar: 'تبقى ملفات الأمام والخلف منفصلة. اختر الصفحة والملاءمة أو الملء لكل غلاف مستقلًا.'
    },
  'Upload a front PDF to place artwork on the front board.': {
    fr: 'Importez un PDF avant pour placer le visuel sur le carton avant.',
    ar: 'ارفع PDF أماميًا لوضع التصميم على اللوح الأمامي.'
  },
  'Upload a separate back PDF when the back artwork is not in the same document.': {
    fr: 'Importez un PDF arrière séparé si le visuel n’est pas dans le même document.',
    ar: 'ارفع PDF خلفيًا مستقلًا عندما لا يكون التصميم الخلفي في المستند نفسه.'
  },
  'Leave off when the PDF has no back-cover page.': {
    fr: 'Laissez désactivé si le PDF ne contient pas de couverture arrière.',
    ar: 'اتركه معطّلًا إذا لم يحتوِ PDF على صفحة غلاف خلفي.'
  },
  'Back cover is OFF. The back board will stay blank.': {
    fr: 'La couverture arrière est désactivée. Le carton arrière restera vierge.',
    ar: 'الغلاف الخلفي معطّل. سيبقى اللوح الخلفي فارغًا.'
  },
  'Student name and title are required before batch export.': {
    fr: 'Le nom et le titre sont requis avant l’export par lot.',
    ar: 'اسم الطالب والعنوان مطلوبان قبل التصدير الجماعي.'
  },
  'Drag the front or back artwork directly on the preview to adjust its position.': {
    fr: 'Déplacez le visuel avant ou arrière dans l’aperçu pour ajuster sa position.',
    ar: 'اسحب التصميم الأمامي أو الخلفي مباشرةً في المعاينة لضبط موضعه.'
  },
  'Creating PDF…': {
    fr: 'Création du PDF…',
    ar: 'جارٍ إنشاء PDF…'
  },
  'Loading page...': {
    fr: 'Chargement de la page…',
    ar: 'جارٍ تحميل الصفحة…'
  },
  'Rendering full-quality preview…': {
    fr: 'Création de l’aperçu en pleine qualité…',
    ar: 'جارٍ إعداد معاينة بجودة كاملة…'
  },
  'Press Esc or click outside the page to close': {
    fr: 'Appuyez sur Échap ou cliquez hors de la page pour fermer',
    ar: 'اضغط Esc أو انقر خارج الصفحة للإغلاق'
  },
  'Exports use the selected paper size and millimeter settings.': {
    fr: 'Les exports utilisent le format papier et les dimensions en millimètres choisis.',
    ar: 'تستخدم عمليات التصدير حجم الورق وإعدادات الملليمتر المحددة.'
  },
  'Remove a mistaken import together with all pages created from it.': {
    fr: 'Retirez un import incorrect et toutes les pages qu’il a créées.',
    ar: 'أزل الاستيراد الخاطئ مع كل الصفحات الناتجة عنه.'
  },
  'Booklet page count must be divisible by 4. Add blank pages before export.': {
    fr: 'Le nombre de pages doit être divisible par 4. Ajoutez des pages vierges avant l’export.',
    ar: 'يجب أن يكون عدد صفحات الكتيب من مضاعفات 4. أضف صفحات فارغة قبل التصدير.'
  },
  'Add blank pages before booklet preview/export.': {
    fr: 'Ajoutez des pages vierges avant l’aperçu ou l’export du livret.',
    ar: 'أضف صفحات فارغة قبل معاينة أو تصدير الكتيب.'
  },
  'Selected sheet is no longer available.': {
    fr: 'La feuille sélectionnée n’est plus disponible.',
    ar: 'الورقة المحددة لم تعد متاحة.'
  },
  'No book pages yet': {
    fr: 'Aucune page de livre pour le moment',
    ar: 'لا توجد صفحات كتاب بعد'
  },
  'Add PDF pages, image pages, or blank pages in Sheet Mode to preview the booklet.': {
    fr: 'Ajoutez des pages PDF, images ou vierges en mode feuille pour prévisualiser le livret.',
    ar: 'أضف صفحات PDF أو صورًا أو صفحات فارغة في وضع الورقة لمعاينة الكتيب.'
  },
  '3D Book Preview is paused': {
    fr: 'L’aperçu 3D du livre est en pause',
    ar: 'معاينة الكتاب ثلاثية الأبعاد متوقفة'
  },
  'Montage Mode remains the print-accurate layout.': {
    fr: 'Le mode montage reste la référence exacte pour l’impression.',
    ar: 'يبقى وضع المونتاج التخطيط الدقيق للطباعة.'
  },
  'Interactive book preview unavailable': {
    fr: 'Aperçu interactif du livre indisponible',
    ar: 'معاينة الكتاب التفاعلية غير متاحة'
  },
  'Interactive book preview unavailable. Use Montage View for print accuracy.': {
    fr: 'Aperçu interactif indisponible. Utilisez le montage pour une impression précise.',
    ar: 'المعاينة التفاعلية غير متاحة. استخدم عرض المونتاج لدقة الطباعة.'
  },
  'Import a back design or turn off back-side export.': {
    fr: 'Importez un visuel verso ou désactivez l’export du verso.',
    ar: 'استورد تصميمًا خلفيًا أو عطّل تصدير الوجه الخلفي.'
  },
  'Use page 2 / artboard 2 of front file': {
    fr: 'Utiliser la page 2 / le plan de travail 2 du fichier recto',
    ar: 'استخدام الصفحة 2 / لوحة التصميم 2 من الملف الأمامي'
  },
  'Original image size estimated at 300 dpi.': {
    fr: 'La taille d’image originale est estimée à 300 dpi.',
    ar: 'يُقدّر حجم الصورة الأصلي بدقة 300 نقطة لكل بوصة.'
  },
  'Ctrl + scroll to zoom': {
    fr: 'Ctrl + défilement pour zoomer',
    ar: 'Ctrl + التمرير للتكبير'
  },
  'Transparent artwork is ready in seconds. Photos use local AI background removal.': {
    fr: 'Les visuels transparents sont prêts en quelques secondes. L’IA locale retire le fond des photos.',
    ar: 'التصاميم الشفافة جاهزة في ثوانٍ. تُزال خلفية الصور بالذكاء الاصطناعي المحلي.'
  },
  'Reprocessing replaces mask edits for this image.': {
    fr: 'Le retraitement remplace les modifications de masque de cette image.',
    ar: 'تحل إعادة المعالجة محل تعديلات القناع لهذه الصورة.'
  },
  'Brush size:': {
    fr: 'Taille du pinceau :',
    ar: 'حجم الفرشاة:'
  },
  'Hardness:': {
    fr: 'Dureté :',
    ar: 'الصلابة:'
  },
  'Paint white to keep pixels or black to remove them. The cutline updates when you finish a stroke.':
    {
      fr: 'Peignez en blanc pour garder les pixels, en noir pour les retirer. Le contour s’actualise à la fin du trait.',
      ar: 'ارسم بالأبيض للاحتفاظ بالبكسلات أو بالأسود لإزالتها. يُحدّث خط القص عند إنهاء ضربة الفرشاة.'
    },
  'Cut settings apply to all unsent stickers.': {
    fr: 'Les réglages de découpe s’appliquent à tous les stickers non envoyés.',
    ar: 'تُطبّق إعدادات القص على كل الملصقات غير المرسلة.'
  },
  'The model downloads once, then runs locally. Artwork stays on this machine.': {
    fr: 'Le modèle est téléchargé une fois, puis fonctionne localement. Les visuels restent sur cet ordinateur.',
    ar: 'يُنزّل النموذج مرة واحدة ثم يعمل محليًا. تبقى التصاميم على هذا الجهاز.'
  },
  'Unlock this contour in Layers to adjust it.': {
    fr: 'Déverrouillez ce contour dans les calques pour l’ajuster.',
    ar: 'افتح قفل هذا المسار في الطبقات لتعديله.'
  },
  'Removal tolerance:': {
    fr: 'Tolérance de suppression :',
    ar: 'نسبة تسامح الإزالة:'
  },
  'Select one object to edit exact geometry.': {
    fr: 'Sélectionnez un objet pour modifier sa géométrie exacte.',
    ar: 'حدد عنصرًا واحدًا لتعديل أبعاده بدقة.'
  },
  'Add prepared pieces from the library, then auto arrange or drag them manually.': {
    fr: 'Ajoutez des pièces préparées depuis la bibliothèque, puis disposez-les automatiquement ou manuellement.',
    ar: 'أضف القطع المعدّة من المكتبة ثم رتّبها تلقائيًا أو اسحبها يدويًا.'
  },
  'Import artwork or draw a shape to begin.': {
    fr: 'Importez un visuel ou dessinez une forme pour commencer.',
    ar: 'استورد التصميم أو ارسم شكلًا للبدء.'
  },
  'Shift-click to select more. Drag the grip to change stacking order.': {
    fr: 'Maj-clic pour sélectionner plus. Déplacez la poignée pour modifier l’ordre des calques.',
    ar: 'استخدم Shift مع النقر لتحديد المزيد. اسحب المقبض لتغيير ترتيب الطبقات.'
  },
  'Import a design using the button on the left, then prepare its artwork and cut line.': {
    fr: 'Importez un visuel avec le bouton, puis préparez son image et son contour de découpe.',
    ar: 'استورد تصميمًا باستخدام الزر ثم أعدّ التصميم وخط القص.'
  },
  'Draw around the part you want to keep, then apply the mask. The original image stays intact.': {
    fr: 'Dessinez autour de la partie à garder, puis appliquez le masque. L’image originale reste intacte.',
    ar: 'ارسم حول الجزء الذي تريد الاحتفاظ به ثم طبّق القناع. تبقى الصورة الأصلية سليمة.'
  },
  'Use the prepared mask, artwork bounds, or draw a shape on the canvas.': {
    fr: 'Utilisez le masque préparé, les limites du visuel ou dessinez une forme.',
    ar: 'استخدم القناع المعدّ أو حدود التصميم أو ارسم شكلًا على مساحة التصميم.'
  },
  'Import your first design. Each sticker has its own mask, cut lines and quantity.': {
    fr: 'Importez votre premier visuel. Chaque sticker possède son masque, ses contours et sa quantité.',
    ar: 'استورد تصميمك الأول. لكل ملصق قناعه وخطوط قصه وكميته.'
  },
  'Import a sticker from the library first.': {
    fr: 'Importez d’abord un sticker depuis la bibliothèque.',
    ar: 'استورد ملصقًا من المكتبة أولًا.'
  },
  'Production Dashboard': {
    fr: 'Tableau de bord de production',
    ar: 'لوحة تحكم الإنتاج'
  },
  'No deadlines today': {
    fr: 'Aucune échéance aujourd’hui',
    ar: 'لا توجد مواعيد تسليم اليوم'
  },
  'Keep deliveries on track': {
    fr: 'Respectez les délais de livraison',
    ar: 'حافظ على مواعيد التسليم'
  },
  'Your next run starts here': {
    fr: 'Votre prochaine série commence ici',
    ar: 'تشغيلك القادم يبدأ هنا'
  },
  'Review files before printing': {
    fr: 'Vérifiez les fichiers avant impression',
    ar: 'راجع الملفات قبل الطباعة'
  },
  'Customer approval comes before the next print run.': {
    fr: 'L’accord du client précède la prochaine impression.',
    ar: 'تسبق موافقة العميل عملية الطباعة التالية.'
  },
  'Open a job to review its artwork, deadline, and next step.': {
    fr: 'Ouvrez un travail pour vérifier son visuel, son échéance et la prochaine étape.',
    ar: 'افتح طلبًا لمراجعة التصميم والموعد والخطوة التالية.'
  },
  'Open production jobs': {
    fr: 'Ouvrir les travaux de production',
    ar: 'فتح طلبات الإنتاج'
  },
  'Production activity': {
    fr: 'Activité de production',
    ar: 'نشاط الإنتاج'
  },
  'Your next steps, in delivery order.': {
    fr: 'Vos prochaines étapes, par ordre de livraison.',
    ar: 'خطواتك التالية مرتبة حسب التسليم.'
  },
  'Good work starts with a plan.': {
    fr: 'Un bon travail commence par un plan.',
    ar: 'العمل الجيد يبدأ بخطة.'
  },
  'Track your first customer order. We’ll keep deadlines and next steps in view.': {
    fr: 'Suivez votre première commande. Les échéances et prochaines étapes restent visibles.',
    ar: 'تابع طلب عميلك الأول. ستبقى المواعيد والخطوات التالية واضحة.'
  },
  'Add your first job': {
    fr: 'Ajouter votre premier travail',
    ar: 'إضافة طلبك الأول'
  },
  Draft: {
    fr: 'Brouillon',
    ar: 'مسودة'
  },
  'Waiting approval': {
    fr: 'En attente d’accord',
    ar: 'بانتظار الموافقة'
  },
  Printing: {
    fr: 'En impression',
    ar: 'جارٍ الطباعة'
  },
  Printed: {
    fr: 'Imprimé',
    ar: 'مطبوع'
  },
  Delivered: {
    fr: 'Livré',
    ar: 'تم التسليم'
  },
  Top: {
    fr: 'Haut',
    ar: 'أعلى'
  },
  Bottom: {
    fr: 'Bas',
    ar: 'أسفل'
  },
  Width: {
    fr: 'Largeur',
    ar: 'العرض'
  },
  Height: {
    fr: 'Hauteur',
    ar: 'الارتفاع'
  },
  'Width cm': {
    fr: 'Largeur cm',
    ar: 'العرض سم'
  },
  'Height cm': {
    fr: 'Hauteur cm',
    ar: 'الارتفاع سم'
  },
  Position: {
    fr: 'Position',
    ar: 'الموضع'
  },
  Rotation: {
    fr: 'Rotation',
    ar: 'الدوران'
  },
  Rotate: {
    fr: 'Tourner',
    ar: 'تدوير'
  },
  Layout: {
    fr: 'Mise en page',
    ar: 'التخطيط'
  },
  Paper: {
    fr: 'Papier',
    ar: 'الورق'
  },
  'Margins & cutting marks': {
    fr: 'Marges et repères de coupe',
    ar: 'الهوامش وعلامات القص'
  },
  'Minimum sheet margin (mm)': {
    fr: 'Marge minimale de feuille (mm)',
    ar: 'الهامش الأدنى للورقة (مم)'
  },
  'Card width (cm)': {
    fr: 'Largeur de carte (cm)',
    ar: 'عرض البطاقة (سم)'
  },
  'Card height (cm)': {
    fr: 'Hauteur de carte (cm)',
    ar: 'ارتفاع البطاقة (سم)'
  },
  'Horizontal gap (mm)': {
    fr: 'Espacement horizontal (mm)',
    ar: 'المسافة الأفقية (مم)'
  },
  'Vertical gap (mm)': {
    fr: 'Espacement vertical (mm)',
    ar: 'المسافة العمودية (مم)'
  },
  'Space between columns (cm)': {
    fr: 'Espace entre colonnes (cm)',
    ar: 'المسافة بين الأعمدة (سم)'
  },
  'Card montage settings': {
    fr: 'Paramètres du montage de cartes',
    ar: 'إعدادات مونتاج البطاقات'
  },
  'Import a business card. Get a full A4 sheet ready to print and cut.': {
    fr: 'Importez une carte de visite pour créer une feuille A4 prête à imprimer et découper.',
    ar: 'استورد بطاقة عمل للحصول على ورقة A4 كاملة جاهزة للطباعة والقص.'
  },
  'Side to preview': {
    fr: 'Face à prévisualiser',
    ar: 'الوجه المراد معاينته'
  },
  'Outline color': {
    fr: 'Couleur du contour',
    ar: 'لون الإطار'
  },
  'Front pages': { fr: 'Pages recto', ar: 'صفحات الوجه الأمامي' },
  'Back pages': { fr: 'Pages verso', ar: 'صفحات الوجه الخلفي' },
  'Front artboards': { fr: 'Plans de travail recto', ar: 'لوحات الوجه الأمامي' },
  'Back artboards': { fr: 'Plans de travail verso', ar: 'لوحات الوجه الخلفي' },
  Artboard: { fr: 'Plan de travail', ar: 'لوحة الرسم' },
  'Jump to artboard': { fr: 'Aller au plan de travail', ar: 'الانتقال إلى لوحة الرسم' },
  'Previous page': { fr: 'Page précédente', ar: 'الصفحة السابقة' },
  'Next page': { fr: 'Page suivante', ar: 'الصفحة التالية' },
  'Previous artboard': { fr: 'Plan de travail précédent', ar: 'لوحة الرسم السابقة' },
  'Next artboard': { fr: 'Plan de travail suivant', ar: 'لوحة الرسم التالية' },
  'Page thumbnails': { fr: 'Miniatures des pages', ar: 'معاينات الصفحات' },
  'Scroll thumbnails left': {
    fr: 'Faire défiler les miniatures à gauche',
    ar: 'تمرير المعاينات إلى اليسار'
  },
  'Scroll thumbnails right': {
    fr: 'Faire défiler les miniatures à droite',
    ar: 'تمرير المعاينات إلى اليمين'
  },
  'Cutting rectangle (0.25 px)': {
    fr: 'Rectangle de découpe (0,25 px)',
    ar: 'إطار القص (0.25 بكسل)'
  },
  'Crop crosses (0.25 px)': {
    fr: 'Croix de coupe (0,25 px)',
    ar: 'علامات القص (0.25 بكسل)'
  },
  Margins: {
    fr: 'Marges',
    ar: 'الهوامش'
  },
  'Margins & crop crosses': {
    fr: 'Marges et croix de coupe',
    ar: 'الهوامش وعلامات القص'
  },
  'Crop cross color': {
    fr: 'Couleur des croix de coupe',
    ar: 'لون علامات القص'
  },
  Copy: {
    fr: 'Copier',
    ar: 'نسخ'
  },
  Paste: {
    fr: 'Coller',
    ar: 'لصق'
  },
  Select: {
    fr: 'Sélectionner',
    ar: 'تحديد'
  },
  Move: {
    fr: 'Déplacer',
    ar: 'تحريك'
  },
  Lock: {
    fr: 'Verrouiller',
    ar: 'قفل'
  },
  Unlock: {
    fr: 'Déverrouiller',
    ar: 'فتح القفل'
  },
  'Draw path': {
    fr: 'Tracer un chemin',
    ar: 'رسم مسار'
  },
  Rectangle: {
    fr: 'Rectangle',
    ar: 'مستطيل'
  },
  'Rounded rectangle': {
    fr: 'Rectangle arrondi',
    ar: 'مستطيل بحواف مستديرة'
  },
  Ellipse: {
    fr: 'Ellipse',
    ar: 'شكل بيضاوي'
  },
  Circle: {
    fr: 'Cercle',
    ar: 'دائرة'
  },
  Square: {
    fr: 'Carré',
    ar: 'مربع'
  },
  Rounded: {
    fr: 'Arrondi',
    ar: 'مستدير'
  },
  Shape: {
    fr: 'Forme',
    ar: 'الشكل'
  },
  Stroke: {
    fr: 'Trait',
    ar: 'الحد'
  },
  Mask: {
    fr: 'Masque',
    ar: 'القناع'
  },
  Offset: {
    fr: 'Décalage',
    ar: 'الإزاحة'
  },
  'Offset mm': {
    fr: 'Décalage mm',
    ar: 'الإزاحة مم'
  },
  Cutlines: {
    fr: 'Contours de découpe',
    ar: 'خطوط القص'
  },
  'Artwork layer': {
    fr: 'Calque du visuel',
    ar: 'طبقة التصميم'
  },
  'CutContour layer': {
    fr: 'Calque CutContour',
    ar: 'طبقة CutContour'
  },
  'Group / Link': {
    fr: 'Grouper / lier',
    ar: 'تجميع / ربط'
  },
  'Ungroup / Unlink': {
    fr: 'Dégrouper / délier',
    ar: 'فك التجميع / الربط'
  },
  'Make Clipping Mask': {
    fr: 'Créer un masque d’écrêtage',
    ar: 'إنشاء قناع قص'
  },
  'Release Clipping Mask': {
    fr: 'Libérer le masque d’écrêtage',
    ar: 'تحرير قناع القص'
  },
  'Convert to CutContour': {
    fr: 'Convertir en CutContour',
    ar: 'تحويل إلى CutContour'
  },
  'Duplicate Shape as Cutline': {
    fr: 'Dupliquer la forme en contour',
    ar: 'تكرار الشكل كخط قص'
  },
  'Set as Key Object': {
    fr: 'Définir comme objet clé',
    ar: 'تعيين كعنصر رئيسي'
  },
  'Align Left': {
    fr: 'Aligner à gauche',
    ar: 'محاذاة لليسار'
  },
  'Align Right': {
    fr: 'Aligner à droite',
    ar: 'محاذاة لليمين'
  },
  'Align Top': {
    fr: 'Aligner en haut',
    ar: 'محاذاة للأعلى'
  },
  'Align Bottom': {
    fr: 'Aligner en bas',
    ar: 'محاذاة للأسفل'
  },
  'Align Center Horizontal': {
    fr: 'Centrer horizontalement',
    ar: 'توسيط أفقي'
  },
  'Align Center Vertical': {
    fr: 'Centrer verticalement',
    ar: 'توسيط عمودي'
  },
  'Align left': {
    fr: 'Aligner à gauche',
    ar: 'محاذاة لليسار'
  },
  'Align right': {
    fr: 'Aligner à droite',
    ar: 'محاذاة لليمين'
  },
  'Align top': {
    fr: 'Aligner en haut',
    ar: 'محاذاة للأعلى'
  },
  'Align bottom': {
    fr: 'Aligner en bas',
    ar: 'محاذاة للأسفل'
  },
  'Align center horizontal': {
    fr: 'Centrer horizontalement',
    ar: 'توسيط أفقي'
  },
  'Align center vertical': {
    fr: 'Centrer verticalement',
    ar: 'توسيط عمودي'
  },
  'Print Preview': {
    fr: 'Aperçu avant impression',
    ar: 'معاينة الطباعة'
  },
  'Clean Preview': {
    fr: 'Aperçu épuré',
    ar: 'معاينة نظيفة'
  },
  'Fit preview to workspace': {
    fr: 'Ajuster l’aperçu à l’espace de travail',
    ar: 'ملاءمة المعاينة لمساحة العمل'
  },
  'Fit view': {
    fr: 'Ajuster la vue',
    ar: 'ملاءمة العرض'
  },
  'Expand canvas': {
    fr: 'Agrandir le plan de travail',
    ar: 'توسيع مساحة التصميم'
  },
  'Restore workspace': {
    fr: 'Rétablir l’espace de travail',
    ar: 'استعادة مساحة العمل'
  },
  'Zoom in': {
    fr: 'Zoom avant',
    ar: 'تكبير'
  },
  'Zoom out': {
    fr: 'Zoom arrière',
    ar: 'تصغير'
  },
  'Preparing…': {
    fr: 'Préparation…',
    ar: 'جارٍ الإعداد…'
  },
  'Preparing print…': {
    fr: 'Préparation de l’impression…',
    ar: 'جارٍ إعداد الطباعة…'
  },
  'Printing opens your printer driver dialog. Check paper size, duplex, and scale before printing.':
    {
      fr: 'L’impression ouvre le pilote d’imprimante. Vérifiez le papier, le recto verso et l’échelle.',
      ar: 'تفتح الطباعة نافذة تعريف الطابعة. تحقق من حجم الورق والوجهين والمقياس قبل الطباعة.'
    },
  'Printing is available in the desktop app. Export a PDF to print from this browser.': {
    fr: 'L’impression est disponible dans l’application de bureau. Exportez un PDF pour imprimer depuis le navigateur.',
    ar: 'الطباعة متاحة في تطبيق سطح المكتب. صدّر PDF للطباعة من هذا المتصفح.'
  },
  'Sheet Mode': {
    fr: 'Mode feuille',
    ar: 'وضع الورقة'
  },
  'Montage Mode': {
    fr: 'Mode montage',
    ar: 'وضع المونتاج'
  },
  'Sheet width': {
    fr: 'Largeur de feuille',
    ar: 'عرض الورقة'
  },
  'Sheet height': {
    fr: 'Hauteur de feuille',
    ar: 'ارتفاع الورقة'
  },
  'Sheet width (mm)': {
    fr: 'Largeur de feuille (mm)',
    ar: 'عرض الورقة (مم)'
  },
  'Sheet height (mm)': {
    fr: 'Hauteur de feuille (mm)',
    ar: 'ارتفاع الورقة (مم)'
  },
  'Sheet margin': {
    fr: 'Marge de feuille',
    ar: 'هامش الورقة'
  },
  'Sheet margin (mm)': {
    fr: 'Marge de feuille (mm)',
    ar: 'هامش الورقة (مم)'
  },
  'Sheet color': {
    fr: 'Couleur de feuille',
    ar: 'لون الورقة'
  },
  'Blank page fill': {
    fr: 'Fond de page vierge',
    ar: 'تعبئة الصفحة الفارغة'
  },
  'Blank page fill color': {
    fr: 'Couleur de page vierge',
    ar: 'لون تعبئة الصفحة الفارغة'
  },
  'Left page': {
    fr: 'Page gauche',
    ar: 'الصفحة اليسرى'
  },
  'Right page': {
    fr: 'Page droite',
    ar: 'الصفحة اليمنى'
  },
  'Creep Compensation': {
    fr: 'Compensation de chasse',
    ar: 'تعويض الزحف'
  },
  'Creep compensation': {
    fr: 'Compensation de chasse',
    ar: 'تعويض الزحف'
  },
  'Crop marks': {
    fr: 'Repères de coupe',
    ar: 'علامات القص'
  },
  'Saddle-stitch spine': {
    fr: 'Dos de piqûre à cheval',
    ar: 'كعب التجليد بالدبابيس'
  },
  'Shift inner-sheet artwork progressively toward the saddle-stitch spine.': {
    fr: 'Décaler progressivement les visuels intérieurs vers le dos du livret.',
    ar: 'إزاحة تصاميم الأوراق الداخلية تدريجيًا نحو كعب التجليد.'
  },
  'Source PDF': {
    fr: 'PDF source',
    ar: 'PDF المصدر'
  },
  'Book direction': {
    fr: 'Sens du livre',
    ar: 'اتجاه الكتاب'
  },
  'Book measurement settings': {
    fr: 'Paramètres des dimensions du livre',
    ar: 'إعدادات قياسات الكتاب'
  },
  'Cover and binding': {
    fr: 'Couverture et reliure',
    ar: 'الغلاف والتجليد'
  },
  'Board preset': {
    fr: 'Préréglage du carton',
    ar: 'إعداد اللوح المسبق'
  },
  'Board width': {
    fr: 'Largeur du carton',
    ar: 'عرض اللوح'
  },
  'Board height': {
    fr: 'Hauteur du carton',
    ar: 'ارتفاع اللوح'
  },
  'Guide mark length': {
    fr: 'Longueur des repères',
    ar: 'طول علامات الدليل'
  },
  'Left band': {
    fr: 'Bande gauche',
    ar: 'الشريط الأيسر'
  },
  'Right band': {
    fr: 'Bande droite',
    ar: 'الشريط الأيمن'
  },
  'Use same band width': {
    fr: 'Utiliser la même largeur de bande',
    ar: 'استخدام عرض الشريط نفسه'
  },
  'Center structure on sheet': {
    fr: 'Centrer la structure sur la feuille',
    ar: 'توسيط الهيكل على الورقة'
  },
  'Printer preset': {
    fr: 'Préréglage d’imprimante',
    ar: 'إعداد الطابعة المسبق'
  },
  'Essential measurements': {
    fr: 'Dimensions essentielles',
    ar: 'القياسات الأساسية'
  },
  'Spine width': {
    fr: 'Largeur du dos',
    ar: 'عرض الكعب'
  },
  'Spine editor': {
    fr: 'Éditeur du dos',
    ar: 'محرر الكعب'
  },
  'Spine background': {
    fr: 'Fond du dos',
    ar: 'خلفية الكعب'
  },
  'Spine short title': {
    fr: 'Titre court du dos',
    ar: 'عنوان الكعب المختصر'
  },
  'Front cover source': {
    fr: 'Source de couverture avant',
    ar: 'مصدر الغلاف الأمامي'
  },
  'Back source page': {
    fr: 'Page source arrière',
    ar: 'صفحة المصدر الخلفي'
  },
  'Back Cover ON': {
    fr: 'Couverture arrière activée',
    ar: 'الغلاف الخلفي مفعّل'
  },
  'Back Cover OFF': {
    fr: 'Couverture arrière désactivée',
    ar: 'الغلاف الخلفي معطّل'
  },
  'Student name': {
    fr: 'Nom de l’étudiant',
    ar: 'اسم الطالب'
  },
  'Academic year': {
    fr: 'Année universitaire',
    ar: 'السنة الدراسية'
  },
  'Academic year - top of spine': {
    fr: 'Année universitaire - haut du dos',
    ar: 'السنة الدراسية - أعلى الكعب'
  },
  'Student name - bottom of spine': {
    fr: 'Nom de l’étudiant - bas du dos',
    ar: 'اسم الطالب - أسفل الكعب'
  },
  'Title / mémoire title - middle of spine': {
    fr: 'Titre du mémoire - milieu du dos',
    ar: 'عنوان المذكرة - وسط الكعب'
  },
  Title: {
    fr: 'Titre',
    ar: 'العنوان'
  },
  Year: {
    fr: 'Année',
    ar: 'السنة'
  },
  'University / institute': {
    fr: 'Université / institut',
    ar: 'الجامعة / المعهد'
  },
  'Degree / diploma': {
    fr: 'Diplôme',
    ar: 'الشهادة / الدبلوم'
  },
  Department: {
    fr: 'Département',
    ar: 'القسم'
  },
  Supervisor: {
    fr: 'Encadrant',
    ar: 'المشرف'
  },
  'Project / mémoire title': {
    fr: 'Titre du projet / mémoire',
    ar: 'عنوان المشروع / المذكرة'
  },
  'Contact / school info': {
    fr: 'Contact / établissement',
    ar: 'معلومات الاتصال / المؤسسة'
  },
  Logo: {
    fr: 'Logo',
    ar: 'الشعار'
  },
  'Background image': {
    fr: 'Image de fond',
    ar: 'صورة الخلفية'
  },
  'QR code text or URL': {
    fr: 'Texte ou URL du code QR',
    ar: 'نص أو رابط رمز QR'
  },
  'Hardcover export settings': {
    fr: 'Paramètres d’export de couverture',
    ar: 'إعدادات تصدير الغلاف الصلب'
  },
  'Cutter export settings': {
    fr: 'Paramètres d’export de découpe',
    ar: 'إعدادات تصدير القص'
  },
  'Cutter sheet settings': {
    fr: 'Paramètres de feuille de découpe',
    ar: 'إعدادات ورقة القص'
  },
  'Auto-expand height': {
    fr: 'Agrandir la hauteur automatiquement',
    ar: 'توسيع الارتفاع تلقائيًا'
  },
  'Production length': {
    fr: 'Longueur de production',
    ar: 'طول الإنتاج'
  },
  'Piece size': {
    fr: 'Taille de pièce',
    ar: 'حجم القطعة'
  },
  'Outer margin mm': {
    fr: 'Marge extérieure mm',
    ar: 'الهامش الخارجي مم'
  },
  'Page gap mm': {
    fr: 'Espacement de pages mm',
    ar: 'المسافة بين الصفحات مم'
  },
  'Copy spacing': {
    fr: 'Espacement des copies',
    ar: 'المسافة بين النسخ'
  },
  Guides: {
    fr: 'Guides',
    ar: 'الأدلة'
  },
  Grid: {
    fr: 'Grille',
    ar: 'الشبكة'
  },
  'Show grid': {
    fr: 'Afficher la grille',
    ar: 'عرض الشبكة'
  },
  Snap: {
    fr: 'Magnétisme',
    ar: 'الالتقاط'
  },
  'Snap to grid': {
    fr: 'Aligner sur la grille',
    ar: 'محاذاة إلى الشبكة'
  },
  'Smart guides': {
    fr: 'Guides intelligents',
    ar: 'أدلة ذكية'
  },
  'Safe zones': {
    fr: 'Zones de sécurité',
    ar: 'مناطق الأمان'
  },
  'Safe area': {
    fr: 'Zone de sécurité',
    ar: 'منطقة الأمان'
  },
  Scale: {
    fr: 'Échelle',
    ar: 'المقياس'
  },
  Placement: {
    fr: 'Placement',
    ar: 'الموضع'
  },
  'Print artwork': {
    fr: 'Imprimer le visuel',
    ar: 'طباعة التصميم'
  },
  'Duplicate sheet': {
    fr: 'Dupliquer la feuille',
    ar: 'تكرار الورقة'
  },
  'Delete sheet': {
    fr: 'Supprimer la feuille',
    ar: 'حذف الورقة'
  },
  'Delete empty sheet': {
    fr: 'Supprimer la feuille vide',
    ar: 'حذف الورقة الفارغة'
  },
  'Inspect sheet': {
    fr: 'Inspecter la feuille',
    ar: 'فحص الورقة'
  },
  'Registration arm length': {
    fr: 'Longueur des bras de repère',
    ar: 'طول أذرع علامات التسجيل'
  },
  'Roll edge guides': {
    fr: 'Guides des bords du rouleau',
    ar: 'أدلة حواف الرول'
  },
  Swatches: {
    fr: 'Nuancier',
    ar: 'عينات الألوان'
  },
  'Numbering settings': {
    fr: 'Paramètres de numérotation',
    ar: 'إعدادات الترقيم'
  },
  'Number sequence': {
    fr: 'Séquence de numéros',
    ar: 'تسلسل الأرقام'
  },
  'Number formatting': {
    fr: 'Format des numéros',
    ar: 'تنسيق الأرقام'
  },
  'Number position': {
    fr: 'Position du numéro',
    ar: 'موضع الرقم'
  },
  'Place numbers and fixed text': {
    fr: 'Placer les numéros et le texte fixe',
    ar: 'وضع الأرقام والنص الثابت'
  },
  'Start number (zeros allowed)': {
    fr: 'Numéro de départ (zéros autorisés)',
    ar: 'رقم البداية (الأصفار مسموحة)'
  },
  'Increase by': {
    fr: 'Incrément',
    ar: 'الزيادة بمقدار'
  },
  'Digits (pad with leading zeros)': {
    fr: 'Chiffres (compléter avec des zéros)',
    ar: 'عدد الخانات (إضافة أصفار بادئة)'
  },
  'Fixed text before number': {
    fr: 'Texte fixe avant le numéro',
    ar: 'نص ثابت قبل الرقم'
  },
  'Fixed text after number': {
    fr: 'Texte fixe après le numéro',
    ar: 'نص ثابت بعد الرقم'
  },
  'Fixed text (same on every item)': {
    fr: 'Texte fixe (identique sur chaque élément)',
    ar: 'نص ثابت (نفسه على كل عنصر)'
  },
  'Font size (pt)': {
    fr: 'Taille de police (pt)',
    ar: 'حجم الخط (نقطة)'
  },
  'Text alignment': {
    fr: 'Alignement du texte',
    ar: 'محاذاة النص'
  },
  'Quantity of items': {
    fr: 'Nombre d’éléments',
    ar: 'عدد العناصر'
  },
  'Item width (mm)': {
    fr: 'Largeur d’élément (mm)',
    ar: 'عرض العنصر (مم)'
  },
  'Item height (mm)': {
    fr: 'Hauteur d’élément (mm)',
    ar: 'ارتفاع العنصر (مم)'
  },
  'Gap between items (mm)': {
    fr: 'Espacement entre éléments (mm)',
    ar: 'المسافة بين العناصر (مم)'
  },
  'Sheet & finished item': {
    fr: 'Feuille et élément fini',
    ar: 'الورقة والعنصر النهائي'
  },
  'Physical sheet': {
    fr: 'Feuille physique',
    ar: 'الورقة الفعلية'
  },
  'Choose how you will collect the numbers': {
    fr: 'Choisir l’ordre de collecte des numéros',
    ar: 'اختر طريقة تجميع الأرقام'
  },
  'Printer duplex setting': {
    fr: 'Réglage recto verso',
    ar: 'إعداد الطباعة على الوجهين'
  },
  'Your name': {
    fr: 'Votre nom',
    ar: 'اسمك'
  },
  Name: {
    fr: 'Nom',
    ar: 'الاسم'
  },
  Company: {
    fr: 'Entreprise',
    ar: 'الشركة'
  },
  Phone: {
    fr: 'Téléphone',
    ar: 'الهاتف'
  },
  'Phone number': {
    fr: 'Numéro de téléphone',
    ar: 'رقم الهاتف'
  },
  Address: {
    fr: 'Adresse',
    ar: 'العنوان'
  },
  'Customer name': {
    fr: 'Nom du client',
    ar: 'اسم العميل'
  },
  'Email address': {
    fr: 'Adresse e-mail',
    ar: 'عنوان البريد الإلكتروني'
  },
  'Confirm password': {
    fr: 'Confirmer le mot de passe',
    ar: 'تأكيد كلمة المرور'
  },
  'Repeat your password': {
    fr: 'Répétez votre mot de passe',
    ar: 'كرر كلمة المرور'
  },
  'Job title': {
    fr: 'Titre du travail',
    ar: 'عنوان الطلب'
  },
  'Job title (required)': {
    fr: 'Titre du travail (obligatoire)',
    ar: 'عنوان الطلب (مطلوب)'
  },
  Deadline: {
    fr: 'Échéance',
    ar: 'الموعد النهائي'
  },
  Optional: {
    fr: 'Facultatif',
    ar: 'اختياري'
  },
  'Optional summary': {
    fr: 'Résumé facultatif',
    ar: 'ملخص اختياري'
  },
  'Optional local project file': {
    fr: 'Fichier de projet local facultatif',
    ar: 'ملف مشروع محلي اختياري'
  },
  'Linked project path': {
    fr: 'Chemin du projet lié',
    ar: 'مسار المشروع المرتبط'
  },
  'Open linked project': {
    fr: 'Ouvrir le projet lié',
    ar: 'فتح المشروع المرتبط'
  },
  'Project name': {
    fr: 'Nom du projet',
    ar: 'اسم المشروع'
  },
  'Edit job': {
    fr: 'Modifier le travail',
    ar: 'تعديل الطلب'
  },
  'Recent jobs': {
    fr: 'Travaux récents',
    ar: 'الطلبات الأخيرة'
  },
  'Search by job, customer, or phone': {
    fr: 'Rechercher par travail, client ou téléphone',
    ar: 'البحث بالطلب أو العميل أو الهاتف'
  },
  'Search name, phone, email, or company': {
    fr: 'Rechercher nom, téléphone, e-mail ou entreprise',
    ar: 'البحث بالاسم أو الهاتف أو البريد أو الشركة'
  },
  'Search pieces': {
    fr: 'Rechercher des pièces',
    ar: 'البحث في القطع'
  },
  'Search project, file, or tool': {
    fr: 'Rechercher un projet, fichier ou outil',
    ar: 'البحث عن مشروع أو ملف أو أداة'
  },
  'Choose a saved customer': {
    fr: 'Choisir un client enregistré',
    ar: 'اختر عميلًا محفوظًا'
  },
  'Finishing, delivery, or customer instructions': {
    fr: 'Instructions de finition, livraison ou du client',
    ar: 'تعليمات التشطيب أو التسليم أو العميل'
  },
  'Name or email': {
    fr: 'Nom ou e-mail',
    ar: 'الاسم أو البريد الإلكتروني'
  },
  'What would you like to make?': {
    fr: 'Que souhaitez-vous produire ?',
    ar: 'ماذا تريد أن تنتج؟'
  },
  'Describe a task, or find a customer / job…': {
    fr: 'Décrivez une tâche ou trouvez un client / travail…',
    ar: 'صف مهمة أو ابحث عن عميل / طلب…'
  },
  'Example: 200 wedding invitations': {
    fr: 'Exemple : 200 invitations de mariage',
    ar: 'مثال: 200 دعوة زفاف'
  },
  'App version': {
    fr: 'Version de l’application',
    ar: 'إصدار التطبيق'
  },
  Build: {
    fr: 'Compilation',
    ar: 'البناء'
  },
  Platform: {
    fr: 'Plateforme',
    ar: 'المنصة'
  },
  'Project data folder': {
    fr: 'Dossier des données de projet',
    ar: 'مجلد بيانات المشاريع'
  },
  Autosaves: {
    fr: 'Sauvegardes automatiques',
    ar: 'الحفظ التلقائي'
  },
  'Last error': {
    fr: 'Dernière erreur',
    ar: 'آخر خطأ'
  },
  'Last export': {
    fr: 'Dernier export',
    ar: 'آخر تصدير'
  },
  License: {
    fr: 'Licence',
    ar: 'الترخيص'
  },
  'Machine Code': {
    fr: 'Code machine',
    ar: 'رمز الجهاز'
  },
  'Current Plan': {
    fr: 'Formule actuelle',
    ar: 'الباقة الحالية'
  },
  'Trial access': {
    fr: 'Accès d’essai',
    ar: 'وصول تجريبي'
  },
  'Trial Started': {
    fr: 'Début de l’essai',
    ar: 'بدء التجربة'
  },
  'Trial Ends': {
    fr: 'Fin de l’essai',
    ar: 'انتهاء التجربة'
  },
  'Trial Remaining': {
    fr: 'Essai restant',
    ar: 'مدة التجربة المتبقية'
  },
  'Paid Tools': {
    fr: 'Outils payants',
    ar: 'الأدوات المدفوعة'
  },
  Expires: {
    fr: 'Expiration',
    ar: 'تاريخ الانتهاء'
  },
  'Last Checked': {
    fr: 'Dernière vérification',
    ar: 'آخر تحقق'
  },
  'Subscription key': {
    fr: 'Clé d’abonnement',
    ar: 'مفتاح الاشتراك'
  },
  'Loading Dashboard...': {
    fr: 'Chargement du tableau de bord…',
    ar: 'جارٍ تحميل لوحة التحكم…'
  },
  'Loading Booklet Montage...': {
    fr: 'Chargement du montage de livrets…',
    ar: 'جارٍ تحميل مونتاج الكتيبات…'
  },
  'Loading Card Montage…': {
    fr: 'Chargement du montage de cartes…',
    ar: 'جارٍ تحميل مونتاج البطاقات…'
  },
  'Loading Cutter Montage...': {
    fr: 'Chargement du montage de découpe…',
    ar: 'جارٍ تحميل مونتاج القص…'
  },
  'Loading Hardcover Cover...': {
    fr: 'Chargement de la couverture rigide…',
    ar: 'جارٍ تحميل الغلاف الصلب…'
  },
  'Loading Sequential Number…': {
    fr: 'Chargement de la numérotation…',
    ar: 'جارٍ تحميل الترقيم التسلسلي…'
  },
  'Loading Access & Subscription...': {
    fr: 'Chargement de l’accès et de l’abonnement…',
    ar: 'جارٍ تحميل الوصول والاشتراك…'
  },
  'Loading Settings...': {
    fr: 'Chargement des paramètres…',
    ar: 'جارٍ تحميل الإعدادات…'
  },
  'Loading Shop Jobs...': {
    fr: 'Chargement des travaux…',
    ar: 'جارٍ تحميل الطلبات…'
  },
  'Loading Export Center...': {
    fr: 'Chargement du centre d’export…',
    ar: 'جارٍ تحميل مركز التصدير…'
  },
  'Loading App Health...': {
    fr: 'Chargement de l’état de l’application…',
    ar: 'جارٍ تحميل حالة التطبيق…'
  },
  'App settings': {
    fr: 'Paramètres de l’application',
    ar: 'إعدادات التطبيق'
  },
  'Update download progress': {
    fr: 'Progression du téléchargement',
    ar: 'تقدم تنزيل التحديث'
  },
  'Request workspace access': {
    fr: 'Demander l’accès',
    ar: 'طلب الوصول إلى مساحة العمل'
  },
  'Your request is awaiting review': {
    fr: 'Votre demande attend une décision',
    ar: 'طلبك بانتظار المراجعة'
  },
  'Your request was denied': {
    fr: 'Votre demande a été refusée',
    ar: 'تم رفض طلبك'
  },
  'Your trial is active': {
    fr: 'Votre essai est actif',
    ar: 'تجربتك مفعّلة'
  },
  'Your access is active': {
    fr: 'Votre accès est actif',
    ar: 'وصولك مفعّل'
  },
  'Your access has expired': {
    fr: 'Votre accès a expiré',
    ar: 'انتهت صلاحية وصولك'
  },
  'Your access was revoked': {
    fr: 'Votre accès a été révoqué',
    ar: 'تم إلغاء وصولك'
  },
  'We could not check your access': {
    fr: 'Impossible de vérifier votre accès',
    ar: 'تعذر التحقق من وصولك'
  },
  'Manage workspace access': {
    fr: 'Gérer l’accès à l’espace de travail',
    ar: 'إدارة الوصول إلى مساحة العمل'
  },
  Dashboard: {
    fr: 'Tableau de bord',
    ar: 'لوحة التحكم'
  },
  Workspace: {
    fr: 'Espace de travail',
    ar: 'مساحة العمل'
  },
  'Workspace navigation': {
    fr: 'Navigation de l’espace de travail',
    ar: 'التنقل في مساحة العمل'
  },
  'Main navigation': {
    fr: 'Navigation principale',
    ar: 'التنقل الرئيسي'
  },
  'Skip to workspace': {
    fr: 'Aller à l’espace de travail',
    ar: 'الانتقال إلى مساحة العمل'
  },
  'Collapse navigation': {
    fr: 'Réduire la navigation',
    ar: 'طي القائمة'
  },
  'Expand navigation': {
    fr: 'Développer la navigation',
    ar: 'توسيع القائمة'
  },
  'Card Montage': {
    fr: 'Montage de cartes',
    ar: 'مونتاج البطاقات'
  },
  'Business Card Montage': {
    fr: 'Montage de cartes de visite',
    ar: 'مونتاج بطاقات العمل'
  },
  'Booklet Montage': {
    fr: 'Montage de livrets',
    ar: 'مونتاج الكتيبات'
  },
  'Hardcover Cover': {
    fr: 'Couverture rigide',
    ar: 'الغلاف الصلب'
  },
  'Hardcover Cover Sheet': {
    fr: 'Feuille de couverture rigide',
    ar: 'ورقة الغلاف الصلب'
  },
  'Hardcover Binding Cover Sheet': {
    fr: 'Couverture pour reliure rigide',
    ar: 'غلاف التجليد الصلب'
  },
  'Cutter Montage': {
    fr: 'Montage de découpe',
    ar: 'مونتاج القص'
  },
  'Cutter Layer + Big Sheet Montage': {
    fr: 'Calque de découpe et montage grand format',
    ar: 'طبقة القص ومونتاج الأوراق الكبيرة'
  },
  'Sequential Number': {
    fr: 'Numérotation séquentielle',
    ar: 'الترقيم التسلسلي'
  },
  'Shop Jobs': {
    fr: 'Travaux de l’atelier',
    ar: 'طلبات المطبعة'
  },
  'Export Center': {
    fr: 'Centre d’export',
    ar: 'مركز التصدير'
  },
  'Account access': {
    fr: 'Accès au compte',
    ar: 'الوصول إلى الحساب'
  },
  'App Health': {
    fr: 'État de l’application',
    ar: 'حالة التطبيق'
  },
  Settings: {
    fr: 'Paramètres',
    ar: 'الإعدادات'
  },
  'Quality Lab': {
    fr: 'Laboratoire qualité',
    ar: 'مختبر الجودة'
  },
  'Access & Subscription': {
    fr: 'Accès et abonnement',
    ar: 'الوصول والاشتراك'
  },
  'Access & Subscription Status': {
    fr: 'État de l’accès et de l’abonnement',
    ar: 'حالة الوصول والاشتراك'
  },
  'Quick open': {
    fr: 'Accès rapide',
    ar: 'الفتح السريع'
  },
  'Quick open (Ctrl+K)': {
    fr: 'Accès rapide (Ctrl+K)',
    ar: 'الفتح السريع (Ctrl+K)'
  },
  'Find anything…': {
    fr: 'Rechercher…',
    ar: 'ابحث عن أي شيء…'
  },
  'Import artwork': {
    fr: 'Importer un visuel',
    ar: 'استيراد التصميم'
  },
  'Import artwork into Cutter Montage': {
    fr: 'Importer un visuel dans le montage de découpe',
    ar: 'استيراد التصميم إلى مونتاج القص'
  },
  'Account menu': {
    fr: 'Menu du compte',
    ar: 'قائمة الحساب'
  },
  'Developer mode': {
    fr: 'Mode développeur',
    ar: 'وضع المطور'
  },
  'Subscription access': {
    fr: 'Accès par abonnement',
    ar: 'الوصول بالاشتراك'
  },
  'Local subscription workspace': {
    fr: 'Espace avec abonnement local',
    ar: 'مساحة الاشتراك المحلي'
  },
  'This computer is unlocked by the current local subscription.': {
    fr: 'Cet ordinateur est activé par l’abonnement local actuel.',
    ar: 'هذا الحاسوب مفعّل بالاشتراك المحلي الحالي.'
  },
  'Sign out': {
    fr: 'Se déconnecter',
    ar: 'تسجيل الخروج'
  },
  'Switch to light mode': {
    fr: 'Passer au mode clair',
    ar: 'التبديل إلى الوضع الفاتح'
  },
  'Switch to dark mode': {
    fr: 'Passer au mode sombre',
    ar: 'التبديل إلى الوضع الداكن'
  },
  'Ready for your next impression?': {
    fr: 'Prêt pour votre prochaine impression ?',
    ar: 'هل أنت جاهز لطباعتك القادمة؟'
  },
  'Your projects, production and finishing touches — in one place.': {
    fr: 'Vos projets, la production et les finitions, au même endroit.',
    ar: 'مشاريعك وإنتاجك ولمساتك النهائية في مكان واحد.'
  },
  'Continue your work': {
    fr: 'Reprendre votre travail',
    ar: 'تابع عملك'
  },
  'Open current project': {
    fr: 'Ouvrir le projet actuel',
    ar: 'فتح المشروع الحالي'
  },
  'Browse saved projects': {
    fr: 'Parcourir les projets enregistrés',
    ar: 'تصفح المشاريع المحفوظة'
  },
  'New project': {
    fr: 'Nouveau projet',
    ar: 'مشروع جديد'
  },
  'Loading your projects…': {
    fr: 'Chargement de vos projets…',
    ar: 'جارٍ تحميل مشاريعك…'
  },
  'Your next print starts here': {
    fr: 'Votre prochaine impression commence ici',
    ar: 'طباعتك القادمة تبدأ هنا'
  },
  'Open a saved project or import your first document.': {
    fr: 'Ouvrez un projet enregistré ou importez votre premier document.',
    ar: 'افتح مشروعًا محفوظًا أو استورد مستندك الأول.'
  },
  'Opening…': {
    fr: 'Ouverture…',
    ar: 'جارٍ الفتح…'
  },
  'Open project': {
    fr: 'Ouvrir le projet',
    ar: 'فتح المشروع'
  },
  'Quick actions': {
    fr: 'Actions rapides',
    ar: 'إجراءات سريعة'
  },
  'Recent projects': {
    fr: 'Projets récents',
    ar: 'المشاريع الأخيرة'
  },
  'Refresh recent projects': {
    fr: 'Actualiser les projets récents',
    ar: 'تحديث المشاريع الأخيرة'
  },
  'Loading recent files…': {
    fr: 'Chargement des fichiers récents…',
    ar: 'جارٍ تحميل الملفات الأخيرة…'
  },
  'File missing': {
    fr: 'Fichier introuvable',
    ar: 'الملف مفقود'
  },
  'No saved projects yet': {
    fr: 'Aucun projet enregistré',
    ar: 'لا توجد مشاريع محفوظة بعد'
  },
  'Save a project from any production workspace to return to it here.': {
    fr: 'Enregistrez un projet depuis un espace de production pour le retrouver ici.',
    ar: 'احفظ مشروعًا من أي مساحة إنتاج للعودة إليه هنا.'
  },
  'Browse projects': {
    fr: 'Parcourir les projets',
    ar: 'تصفح المشاريع'
  },
  'Production queue': {
    fr: 'File de production',
    ar: 'قائمة الإنتاج'
  },
  'Start production': {
    fr: 'Lancer la production',
    ar: 'بدء الإنتاج'
  },
  'What are we making today?': {
    fr: 'Que produisons-nous aujourd’hui ?',
    ar: 'ماذا سننتج اليوم؟'
  },
  'Choose a production action': {
    fr: 'Choisir une action de production',
    ar: 'اختر إجراء الإنتاج'
  },
  'Import PDF': {
    fr: 'Importer un PDF',
    ar: 'استيراد PDF'
  },
  'Arrange pages for booklet imposition': {
    fr: 'Organiser les pages pour l’imposition de livrets',
    ar: 'ترتيب الصفحات لمونتاج الكتيبات'
  },
  'Choose PDF file': {
    fr: 'Choisir un fichier PDF',
    ar: 'اختر ملف PDF'
  },
  'Prepare artwork and cutting contours': {
    fr: 'Préparer le visuel et les contours de découpe',
    ar: 'إعداد التصميم ومسارات القص'
  },
  'Choose artwork': {
    fr: 'Choisir un visuel',
    ar: 'اختر التصميم'
  },
  'New booklet': {
    fr: 'Nouveau livret',
    ar: 'كتيب جديد'
  },
  'Start a new booklet workspace': {
    fr: 'Créer un espace de travail pour livret',
    ar: 'بدء مساحة عمل كتيب جديد'
  },
  'Open Booklet Montage': {
    fr: 'Ouvrir le montage de livrets',
    ar: 'فتح مونتاج الكتيبات'
  },
  'New cutter job': {
    fr: 'Nouveau travail de découpe',
    ar: 'طلب قص جديد'
  },
  'Start a print-and-cut sheet': {
    fr: 'Créer une feuille d’impression et de découpe',
    ar: 'بدء ورقة طباعة وقص'
  },
  'Open Cutter Montage': {
    fr: 'Ouvrir le montage de découpe',
    ar: 'فتح مونتاج القص'
  },
  'Files stay on this computer.': {
    fr: 'Les fichiers restent sur cet ordinateur.',
    ar: 'تبقى الملفات على هذا الحاسوب.'
  },
  'Made for the work you do.': {
    fr: 'Conçu pour votre métier.',
    ar: 'مصمّم لعملك.'
  },
  'Your production toolkit': {
    fr: 'Vos outils de production',
    ar: 'أدوات الإنتاج الخاصة بك'
  },
  Pages: {
    fr: 'Pages',
    ar: 'الصفحات'
  },
  Sheets: {
    fr: 'Feuilles',
    ar: 'الأوراق'
  },
  Output: {
    fr: 'Sortie',
    ar: 'المخرجات'
  },
  'Find the right tool': {
    fr: 'Trouver le bon outil',
    ar: 'اعثر على الأداة المناسبة'
  },
  'Checking access': {
    fr: 'Vérification de l’accès',
    ar: 'جارٍ التحقق من الوصول'
  },
  'View locked tool': {
    fr: 'Voir l’outil verrouillé',
    ar: 'عرض الأداة المقفلة'
  },
  'Open workspace': {
    fr: 'Ouvrir l’espace de travail',
    ar: 'فتح مساحة العمل'
  },
  Artwork: {
    fr: 'Visuel',
    ar: 'التصميم'
  },
  Open: {
    fr: 'Ouvrir',
    ar: 'فتح'
  },
  'Active production': {
    fr: 'Production en cours',
    ar: 'الإنتاج الجاري'
  },
  'Ready to print': {
    fr: 'Prêt à imprimer',
    ar: 'جاهز للطباعة'
  },
  'Due today': {
    fr: 'À livrer aujourd’hui',
    ar: 'مستحق اليوم'
  },
  Overdue: {
    fr: 'En retard',
    ar: 'متأخر'
  },
  'From preparation to collection': {
    fr: 'De la préparation à la remise',
    ar: 'من الإعداد إلى التسليم'
  },
  'Printing · inspect the first finished sheet': {
    fr: 'Impression · vérifier la première feuille produite',
    ar: 'جارٍ الطباعة · افحص الورقة الأولى'
  },
  'A clear view of your work.': {
    fr: 'Une vue claire de votre travail.',
    ar: 'رؤية واضحة لعملك.'
  },
  'Track customer orders and see their real production stage here.': {
    fr: 'Suivez les commandes et leur étape de production ici.',
    ar: 'تابع طلبات العملاء ومراحل إنتاجها هنا.'
  },
  'Open Shop Jobs': {
    fr: 'Ouvrir les travaux de l’atelier',
    ar: 'فتح طلبات المطبعة'
  },
  'Recent exports': {
    fr: 'Exports récents',
    ar: 'عمليات التصدير الأخيرة'
  },
  'Made & ready': {
    fr: 'Terminé et prêt',
    ar: 'مكتمل وجاهز'
  },
  'View all': {
    fr: 'Voir tout',
    ar: 'عرض الكل'
  },
  'Loading exports…': {
    fr: 'Chargement des exports…',
    ar: 'جارٍ تحميل عمليات التصدير…'
  },
  'The finishing touch.': {
    fr: 'La touche finale.',
    ar: 'اللمسة النهائية.'
  },
  'Your exported files will gather here, ready for their next step.': {
    fr: 'Vos fichiers exportés seront réunis ici pour la prochaine étape.',
    ar: 'تظهر ملفاتك المصدّرة هنا جاهزة للخطوة التالية.'
  },
  'Loading recent projects…': {
    fr: 'Chargement des projets récents…',
    ar: 'جارٍ تحميل المشاريع الأخيرة…'
  },
  'Continue a project': {
    fr: 'Reprendre un projet',
    ar: 'متابعة مشروع'
  },
  'Production status': {
    fr: 'État de production',
    ar: 'حالة الإنتاج'
  },
  Appearance: {
    fr: 'Apparence',
    ar: 'المظهر'
  },
  'Color theme': {
    fr: 'Thème de couleur',
    ar: 'سمة الألوان'
  },
  'Light, dark, or follow Windows. Print artwork keeps its original colors.': {
    fr: 'Clair, sombre ou selon Windows. Les visuels imprimés gardent leurs couleurs.',
    ar: 'فاتح أو داكن أو حسب Windows. يحتفظ التصميم المطبوع بألوانه الأصلية.'
  },
  Light: {
    fr: 'Clair',
    ar: 'فاتح'
  },
  Dark: {
    fr: 'Sombre',
    ar: 'داكن'
  },
  System: {
    fr: 'Système',
    ar: 'النظام'
  },
  General: {
    fr: 'Général',
    ar: 'عام'
  },
  Advanced: {
    fr: 'Avancé',
    ar: 'متقدم'
  },
  'Workspace preferences and app management.': {
    fr: 'Préférences de l’espace de travail et gestion de l’application.',
    ar: 'تفضيلات مساحة العمل وإدارة التطبيق.'
  },
  'App management': {
    fr: 'Gestion de l’application',
    ar: 'إدارة التطبيق'
  },
  'Performance, backups and diagnostics. These settings usually only need changing once.': {
    fr: 'Performances, sauvegardes et diagnostics. Ces réglages sont généralement à définir une seule fois.',
    ar: 'الأداء والنسخ الاحتياطي والتشخيص. عادةً تحتاج هذه الإعدادات إلى ضبطها مرة واحدة فقط.'
  },
  Performance: {
    fr: 'Performances',
    ar: 'الأداء'
  },
  'Performance mode': {
    fr: 'Mode de performance',
    ar: 'وضع الأداء'
  },
  'Low-end PC': {
    fr: 'PC peu puissant',
    ar: 'حاسوب محدود الأداء'
  },
  Balanced: {
    fr: 'Équilibré',
    ar: 'متوازن'
  },
  'High quality': {
    fr: 'Haute qualité',
    ar: 'جودة عالية'
  },
  Developer: {
    fr: 'Développeur',
    ar: 'المطور'
  },
  'App updates': {
    fr: 'Mises à jour',
    ar: 'تحديثات التطبيق'
  },
  'Restart to update': {
    fr: 'Redémarrer pour mettre à jour',
    ar: 'إعادة التشغيل للتحديث'
  },
  'Checking…': {
    fr: 'Vérification…',
    ar: 'جارٍ التحقق…'
  },
  'Check now': {
    fr: 'Vérifier maintenant',
    ar: 'تحقق الآن'
  },
  Downloading: {
    fr: 'Téléchargement',
    ar: 'جارٍ التنزيل'
  },
  Ready: {
    fr: 'Prêt',
    ar: 'جاهز'
  },
  'Up to date': {
    fr: 'À jour',
    ar: 'محدّث'
  },
  'Check failed': {
    fr: 'Échec de la vérification',
    ar: 'فشل التحقق'
  },
  Checking: {
    fr: 'Vérification',
    ar: 'جارٍ التحقق'
  },
  'Storage, diagnostics, cache, recovery, and app information.': {
    fr: 'Stockage, diagnostics, cache, récupération et informations de l’application.',
    ar: 'التخزين والتشخيص والذاكرة المؤقتة والاسترداد ومعلومات التطبيق.'
  },
  'Development-only fixtures and release checks.': {
    fr: 'Données de test et vérifications de version pour le développement.',
    ar: 'بيانات اختبار وفحوصات الإصدارات للتطوير.'
  },
  'Backup & restore': {
    fr: 'Sauvegarde et restauration',
    ar: 'النسخ الاحتياطي والاستعادة'
  },
  'Back up now': {
    fr: 'Sauvegarder maintenant',
    ar: 'نسخ احتياطي الآن'
  },
  'Backup folder': {
    fr: 'Dossier de sauvegarde',
    ar: 'مجلد النسخ الاحتياطي'
  },
  'Back to Settings': {
    fr: 'Retour aux paramètres',
    ar: 'العودة إلى الإعدادات'
  },
  'Back to Dashboard': {
    fr: 'Retour au tableau de bord',
    ar: 'العودة إلى لوحة التحكم'
  },
  'All tools': {
    fr: 'Tous les outils',
    ar: 'كل الأدوات'
  },
  'Output actions': {
    fr: 'Actions de sortie',
    ar: 'إجراءات الإخراج'
  },
  Print: {
    fr: 'Imprimer',
    ar: 'طباعة'
  },
  Save: {
    fr: 'Enregistrer',
    ar: 'حفظ'
  },
  'Save As': {
    fr: 'Enregistrer sous',
    ar: 'حفظ باسم'
  },
  'Save as': {
    fr: 'Enregistrer sous',
    ar: 'حفظ باسم'
  },
  'New Project': {
    fr: 'Nouveau projet',
    ar: 'مشروع جديد'
  },
  New: {
    fr: 'Nouveau',
    ar: 'جديد'
  },
  Import: {
    fr: 'Importer',
    ar: 'استيراد'
  },
  Export: {
    fr: 'Exporter',
    ar: 'تصدير'
  },
  'Export PDF': {
    fr: 'Exporter en PDF',
    ar: 'تصدير PDF'
  },
  'Export all': {
    fr: 'Tout exporter',
    ar: 'تصدير الكل'
  },
  'Export SVG': {
    fr: 'Exporter en SVG',
    ar: 'تصدير SVG'
  },
  'Export mode': {
    fr: 'Mode d’export',
    ar: 'وضع التصدير'
  },
  Cancel: {
    fr: 'Annuler',
    ar: 'إلغاء'
  },
  Close: {
    fr: 'Fermer',
    ar: 'إغلاق'
  },
  Clear: {
    fr: 'Effacer',
    ar: 'مسح'
  },
  Reset: {
    fr: 'Réinitialiser',
    ar: 'إعادة ضبط'
  },
  Restore: {
    fr: 'Restaurer',
    ar: 'استعادة'
  },
  Remove: {
    fr: 'Retirer',
    ar: 'إزالة'
  },
  Delete: {
    fr: 'Supprimer',
    ar: 'حذف'
  },
  Edit: {
    fr: 'Modifier',
    ar: 'تعديل'
  },
  Duplicate: {
    fr: 'Dupliquer',
    ar: 'تكرار'
  },
  Undo: {
    fr: 'Annuler',
    ar: 'تراجع'
  },
  Redo: {
    fr: 'Rétablir',
    ar: 'إعادة'
  },
  Refresh: {
    fr: 'Actualiser',
    ar: 'تحديث'
  },
  Preview: {
    fr: 'Aperçu',
    ar: 'معاينة'
  },
  'Sheet preview': {
    fr: 'Aperçu de la feuille',
    ar: 'معاينة الورقة'
  },
  Sheet: {
    fr: 'Feuille',
    ar: 'ورقة'
  },
  Page: {
    fr: 'Page',
    ar: 'صفحة'
  },
  Copies: {
    fr: 'Copies',
    ar: 'النسخ'
  },
  Quantity: {
    fr: 'Quantité',
    ar: 'الكمية'
  },
  Size: {
    fr: 'Taille',
    ar: 'الحجم'
  },
  Background: {
    fr: 'Fond',
    ar: 'الخلفية'
  },
  'Background color': {
    fr: 'Couleur de fond',
    ar: 'لون الخلفية'
  },
  Fit: {
    fr: 'Ajuster',
    ar: 'ملاءمة'
  },
  Fill: {
    fr: 'Remplir',
    ar: 'ملء'
  },
  Zoom: {
    fr: 'Zoom',
    ar: 'تكبير'
  },
  Color: {
    fr: 'Couleur',
    ar: 'اللون'
  },
  Orientation: {
    fr: 'Orientation',
    ar: 'الاتجاه'
  },
  Front: {
    fr: 'Recto',
    ar: 'الأمام'
  },
  Back: {
    fr: 'Verso',
    ar: 'الخلف'
  },
  'Front side': {
    fr: 'Recto',
    ar: 'الوجه الأمامي'
  },
  'Back side': {
    fr: 'Verso',
    ar: 'الوجه الخلفي'
  },
  'Both sides': {
    fr: 'Recto verso',
    ar: 'الوجهان'
  },
  'Front only': {
    fr: 'Recto seul',
    ar: 'الأمام فقط'
  },
  'Back only': {
    fr: 'Verso seul',
    ar: 'الخلف فقط'
  },
  Side: {
    fr: 'Face',
    ar: 'الوجه'
  },
  'Printer settings': {
    fr: 'Paramètres de l’imprimante',
    ar: 'إعدادات الطابعة'
  },
  'Print cards': {
    fr: 'Imprimer les cartes',
    ar: 'طباعة البطاقات'
  },
  'Choose sides and copies before opening printer settings.': {
    fr: 'Choisissez les faces et le nombre de copies avant d’ouvrir les paramètres d’impression.',
    ar: 'اختر الأوجه وعدد النسخ قبل فتح إعدادات الطابعة.'
  },
  'Selected sheet': {
    fr: 'Feuille sélectionnée',
    ar: 'الورقة المحددة'
  },
  Empty: {
    fr: 'Vide',
    ar: 'فارغ'
  },
  Blank: {
    fr: 'Vierge',
    ar: 'فارغ'
  },
  'Blank page': {
    fr: 'Page vierge',
    ar: 'صفحة فارغة'
  },
  'Blank Page': {
    fr: 'Page vierge',
    ar: 'صفحة فارغة'
  },
  'Empty Sheet': {
    fr: 'Feuille vide',
    ar: 'ورقة فارغة'
  },
  'Add Empty Sheet': {
    fr: 'Ajouter une feuille vide',
    ar: 'إضافة ورقة فارغة'
  },
  'Add Blank Page': {
    fr: 'Ajouter une page vierge',
    ar: 'إضافة صفحة فارغة'
  },
  'Select all': {
    fr: 'Tout sélectionner',
    ar: 'تحديد الكل'
  },
  'Select none': {
    fr: 'Tout désélectionner',
    ar: 'إلغاء التحديد'
  },
  'Apply range': {
    fr: 'Appliquer la plage',
    ar: 'تطبيق النطاق'
  },
  'Page range': {
    fr: 'Plage de pages',
    ar: 'نطاق الصفحات'
  },
  'Page 1 only': {
    fr: 'Page 1 uniquement',
    ar: 'الصفحة الأولى فقط'
  },
  'PDF pages': {
    fr: 'Pages PDF',
    ar: 'صفحات PDF'
  },
  'Load more pages': {
    fr: 'Charger plus de pages',
    ar: 'تحميل المزيد من الصفحات'
  },
  'More import options': {
    fr: 'Autres options d’import',
    ar: 'خيارات استيراد إضافية'
  },
  'Import images': {
    fr: 'Importer des images',
    ar: 'استيراد الصور'
  },
  'Import JPG/PNG': {
    fr: 'Importer JPG/PNG',
    ar: 'استيراد JPG/PNG'
  },
  'Image exports': {
    fr: 'Exports d’images',
    ar: 'تصدير الصور'
  },
  'PNG Sheets': {
    fr: 'Feuilles PNG',
    ar: 'أوراق PNG'
  },
  'JPG Sheets': {
    fr: 'Feuilles JPG',
    ar: 'أوراق JPG'
  },
  'PNG sheets': {
    fr: 'Feuilles PNG',
    ar: 'أوراق PNG'
  },
  'JPG sheets': {
    fr: 'Feuilles JPG',
    ar: 'أوراق JPG'
  },
  '3D Book Mode': {
    fr: 'Mode livre 3D',
    ar: 'وضع الكتاب ثلاثي الأبعاد'
  },
  'Booklet settings': {
    fr: 'Paramètres du livret',
    ar: 'إعدادات الكتيب'
  },
  'Auto blanks': {
    fr: 'Pages vierges auto',
    ar: 'صفحات فارغة تلقائيًا'
  },
  'Reset layout': {
    fr: 'Réinitialiser la mise en page',
    ar: 'إعادة ضبط التخطيط'
  },
  'Ready for local PDF or image input.': {
    fr: 'Prêt à importer un PDF ou une image locale.',
    ar: 'جاهز لاستيراد PDF أو صورة محلية.'
  },
  Eyedropper: {
    fr: 'Pipette',
    ar: 'قطارة الألوان'
  },
  'No document loaded': {
    fr: 'Aucun document chargé',
    ar: 'لم يتم تحميل مستند'
  },
  'Import a PDF or images with the toolbar above. Your pages appear on the left, ready to arrange.':
    {
      fr: 'Importez un PDF ou des images avec la barre d’outils. Les pages seront prêtes à organiser.',
      ar: 'استورد PDF أو صورًا من شريط الأدوات أعلاه. ستظهر الصفحات جاهزة للترتيب.'
    },
  'Page preview failed': {
    fr: 'Échec de l’aperçu',
    ar: 'فشلت معاينة الصفحة'
  },
  'Preview unavailable': {
    fr: 'Aperçu indisponible',
    ar: 'المعاينة غير متاحة'
  },
  'Page inspection': {
    fr: 'Inspection de page',
    ar: 'فحص الصفحة'
  },
  'Page Order': {
    fr: 'Ordre des pages',
    ar: 'ترتيب الصفحات'
  },
  'Total pages:': {
    fr: 'Total des pages :',
    ar: 'إجمالي الصفحات:'
  },
  'Selected:': {
    fr: 'Sélection :',
    ar: 'المحدد:'
  },
  'Auto add blank pages': {
    fr: 'Ajouter automatiquement des pages vierges',
    ar: 'إضافة صفحات فارغة تلقائيًا'
  },
  'Reset to Original Order': {
    fr: 'Rétablir l’ordre original',
    ar: 'استعادة الترتيب الأصلي'
  },
  'Remove blanks + reset': {
    fr: 'Retirer les pages vierges et réinitialiser',
    ar: 'إزالة الصفحات الفارغة وإعادة الضبط'
  },
  'Imported artwork and PDF files': {
    fr: 'Visuels et fichiers PDF importés',
    ar: 'التصاميم وملفات PDF المستوردة'
  },
  'No sheets on the board yet': {
    fr: 'Aucune feuille sur le plan de travail',
    ar: 'لا توجد أوراق في مساحة العمل بعد'
  },
  'Back to Montage Board': {
    fr: 'Retour au plan de montage',
    ar: 'العودة إلى لوحة المونتاج'
  },
  'Delete this empty sheet': {
    fr: 'Supprimer cette feuille vide',
    ar: 'حذف هذه الورقة الفارغة'
  },
  'Previous Page': {
    fr: 'Page précédente',
    ar: 'الصفحة السابقة'
  },
  'Next Page': {
    fr: 'Page suivante',
    ar: 'الصفحة التالية'
  },
  'Reset to First Page': {
    fr: 'Revenir à la première page',
    ar: 'العودة إلى الصفحة الأولى'
  },
  'Load 3D Preview': {
    fr: 'Charger l’aperçu 3D',
    ar: 'تحميل المعاينة ثلاثية الأبعاد'
  },
  Interactive: {
    fr: 'Interactif',
    ar: 'تفاعلي'
  },
  'Use original size': {
    fr: 'Utiliser la taille originale',
    ar: 'استخدام الحجم الأصلي'
  },
  'Artwork sizing': {
    fr: 'Taille du visuel',
    ar: 'تحجيم التصميم'
  },
  'Resize to exact card size': {
    fr: 'Redimensionner à la taille exacte',
    ar: 'تغيير الحجم إلى قياس البطاقة الدقيق'
  },
  'Keep proportions (may leave white borders)': {
    fr: 'Garder les proportions (bordures blanches possibles)',
    ar: 'الحفاظ على النسب (قد يترك حواف بيضاء)'
  },
  '2. Choose montage': {
    fr: '2. Choisir le montage',
    ar: '2. اختر المونتاج'
  },
  '3. A4 sheet setup': {
    fr: '3. Configuration de la feuille A4',
    ar: '3. إعداد ورقة A4'
  },
  'Choose card size or enter your own below': {
    fr: 'Choisissez la taille de carte ou saisissez vos dimensions',
    ar: 'اختر حجم البطاقة أو أدخل القياسات أدناه'
  },
  'Portrait · 21 × 29.7 cm': {
    fr: 'Portrait · 21 × 29,7 cm',
    ar: 'عمودي · 21 × 29.7 سم'
  },
  'Landscape · 29.7 × 21 cm': {
    fr: 'Paysage · 29,7 × 21 cm',
    ar: 'أفقي · 29.7 × 21 سم'
  },
  'Remove back': {
    fr: 'Retirer le verso',
    ar: 'إزالة الخلف'
  },
  'Include back in export and printing': {
    fr: 'Inclure le verso à l’export et à l’impression',
    ar: 'تضمين الخلف في التصدير والطباعة'
  },
  'Original file size:': {
    fr: 'Taille du fichier original :',
    ar: 'حجم الملف الأصلي:'
  },
  'Printed card size:': {
    fr: 'Taille de carte imprimée :',
    ar: 'حجم البطاقة المطبوعة:'
  },
  'Add artwork, refine the edges, then send to your cutter.': {
    fr: 'Ajoutez un visuel, affinez les contours puis envoyez-le à la découpe.',
    ar: 'أضف التصميم وحسّن الحواف ثم أرسله إلى جهاز القص.'
  },
  'Add images': {
    fr: 'Ajouter des images',
    ar: 'إضافة صور'
  },
  'Stop after current': {
    fr: 'Arrêter après l’image actuelle',
    ar: 'التوقف بعد الصورة الحالية'
  },
  Send: {
    fr: 'Envoyer',
    ar: 'إرسال'
  },
  'to Cutter': {
    fr: 'vers la découpe',
    ar: 'إلى جهاز القص'
  },
  'Artwork queue': {
    fr: 'File de visuels',
    ar: 'قائمة التصاميم'
  },
  'Drop images here or choose Add images.': {
    fr: 'Déposez des images ici ou choisissez Ajouter des images.',
    ar: 'أفلت الصور هنا أو اختر إضافة صور.'
  },
  'Transparency grid': {
    fr: 'Grille de transparence',
    ar: 'شبكة الشفافية'
  },
  'White background': {
    fr: 'Fond blanc',
    ar: 'خلفية بيضاء'
  },
  'Dark background': {
    fr: 'Fond sombre',
    ar: 'خلفية داكنة'
  },
  'Drop your artwork here': {
    fr: 'Déposez votre visuel ici',
    ar: 'أفلت تصميمك هنا'
  },
  'or click to browse JPG, PNG, and WebP images': {
    fr: 'ou cliquez pour choisir des images JPG, PNG et WebP',
    ar: 'أو انقر لتصفح صور JPG وPNG وWebP'
  },
  'Auto detect': {
    fr: 'Détecter automatiquement',
    ar: 'كشف تلقائي'
  },
  'Remove with AI': {
    fr: 'Supprimer avec l’IA',
    ar: 'إزالة بالذكاء الاصطناعي'
  },
  'Keep original': {
    fr: 'Garder l’original',
    ar: 'الاحتفاظ بالأصل'
  },
  'Correct mask': {
    fr: 'Corriger le masque',
    ar: 'تصحيح القناع'
  },
  Erase: {
    fr: 'Effacer',
    ar: 'محو'
  },
  'Reset mask': {
    fr: 'Réinitialiser le masque',
    ar: 'إعادة ضبط القناع'
  },
  'Artwork width (mm)': {
    fr: 'Largeur du visuel (mm)',
    ar: 'عرض التصميم (مم)'
  },
  'Cut offset (mm)': {
    fr: 'Décalage de découpe (mm)',
    ar: 'إزاحة القص (مم)'
  },
  'Alpha threshold': {
    fr: 'Seuil alpha',
    ar: 'عتبة الشفافية'
  },
  'Contour smoothing': {
    fr: 'Lissage du contour',
    ar: 'تنعيم المسار'
  },
  Low: {
    fr: 'Faible',
    ar: 'منخفض'
  },
  Medium: {
    fr: 'Moyen',
    ar: 'متوسط'
  },
  High: {
    fr: 'Élevé',
    ar: 'مرتفع'
  },
  'AI Sticker Maker': {
    fr: 'Créateur de stickers IA',
    ar: 'صانع الملصقات بالذكاء الاصطناعي'
  },
  Selection: {
    fr: 'Sélection',
    ar: 'التحديد'
  },
  'Main objects': {
    fr: 'Objets principaux',
    ar: 'العناصر الرئيسية'
  },
  Align: {
    fr: 'Aligner',
    ar: 'محاذاة'
  },
  Layers: {
    fr: 'Calques',
    ar: 'الطبقات'
  },
  'Key-object alignment': {
    fr: 'Alignement sur l’objet clé',
    ar: 'المحاذاة إلى العنصر الرئيسي'
  },
  'Center artwork inside mask': {
    fr: 'Centrer le visuel dans le masque',
    ar: 'توسيط التصميم داخل القناع'
  },
  'Center artwork inside cutline': {
    fr: 'Centrer le visuel dans le contour',
    ar: 'توسيط التصميم داخل خط القص'
  },
  'Center cutline around mask': {
    fr: 'Centrer le contour autour du masque',
    ar: 'توسيط خط القص حول القناع'
  },
  'Match cutline to mask': {
    fr: 'Adapter le contour au masque',
    ar: 'مطابقة خط القص للقناع'
  },
  'Match mask to cutline': {
    fr: 'Adapter le masque au contour',
    ar: 'مطابقة القناع لخط القص'
  },
  'Remove solid background': {
    fr: 'Supprimer le fond uni',
    ar: 'إزالة الخلفية الموحدة'
  },
  'Add background color': {
    fr: 'Ajouter une couleur de fond',
    ar: 'إضافة لون خلفية'
  },
  'Updating artwork…': {
    fr: 'Mise à jour du visuel…',
    ar: 'جارٍ تحديث التصميم…'
  },
  'Cutline Inspector': {
    fr: 'Inspecteur du contour de découpe',
    ar: 'فاحص خط القص'
  },
  'Select a piece to inspect CutContour.': {
    fr: 'Sélectionnez une pièce pour inspecter CutContour.',
    ar: 'حدد قطعة لفحص CutContour.'
  },
  'Create from artwork bounds': {
    fr: 'Créer depuis les limites du visuel',
    ar: 'إنشاء من حدود التصميم'
  },
  'Create from mask': {
    fr: 'Créer depuis le masque',
    ar: 'إنشاء من القناع'
  },
  'Cut edge precision': {
    fr: 'Précision du bord de découpe',
    ar: 'دقة حافة القص'
  },
  'Contour to adjust': {
    fr: 'Contour à ajuster',
    ar: 'المسار المراد ضبطه'
  },
  'Cut adjustment mm': {
    fr: 'Ajustement de découpe en mm',
    ar: 'ضبط القص بالملليمتر'
  },
  'Inward −': {
    fr: 'Vers l’intérieur −',
    ar: 'للداخل −'
  },
  'Outward +': {
    fr: 'Vers l’extérieur +',
    ar: 'للخارج +'
  },
  'Zero adjustment': {
    fr: 'Aucun ajustement',
    ar: 'بدون تعديل'
  },
  'Adjustment step': {
    fr: 'Pas d’ajustement',
    ar: 'خطوة التعديل'
  },
  'Edge close-up': {
    fr: 'Détail du bord',
    ar: 'تكبير الحافة'
  },
  Cutline: {
    fr: 'Contour de découpe',
    ar: 'خط القص'
  },
  'From Artwork': {
    fr: 'Depuis le visuel',
    ar: 'من التصميم'
  },
  'From Mask': {
    fr: 'Depuis le masque',
    ar: 'من القناع'
  },
  'From Shape': {
    fr: 'Depuis la forme',
    ar: 'من الشكل'
  },
  'Spot name': {
    fr: 'Nom de ton direct',
    ar: 'اسم اللون الخاص'
  },
  'Piece Editor': {
    fr: 'Éditeur de pièce',
    ar: 'محرر القطعة'
  },
  'Montage Sheet': {
    fr: 'Feuille de montage',
    ar: 'ورقة المونتاج'
  },
  'Arrange Copies': {
    fr: 'Disposer les copies',
    ar: 'ترتيب النسخ'
  },
  'Undo Arrange': {
    fr: 'Annuler la disposition',
    ar: 'التراجع عن الترتيب'
  },
  'Sheet setup': {
    fr: 'Configuration de la feuille',
    ar: 'إعداد الورقة'
  },
  'Arrangement order': {
    fr: 'Ordre de disposition',
    ar: 'ترتيب التوزيع'
  },
  'Largest first': {
    fr: 'Plus grandes d’abord',
    ar: 'الأكبر أولًا'
  },
  'Smallest first': {
    fr: 'Plus petites d’abord',
    ar: 'الأصغر أولًا'
  },
  'Piece name': {
    fr: 'Nom de la pièce',
    ar: 'اسم القطعة'
  },
  'Production Export': {
    fr: 'Export de production',
    ar: 'تصدير الإنتاج'
  },
  'Export Checklist': {
    fr: 'Liste de contrôle d’export',
    ar: 'قائمة فحص التصدير'
  },
  'Print + Cut': {
    fr: 'Impression + découpe',
    ar: 'طباعة وقص'
  },
  'Print only': {
    fr: 'Impression seule',
    ar: 'طباعة فقط'
  },
  'Cut only': {
    fr: 'Découpe seule',
    ar: 'قص فقط'
  },
  'Test cut': {
    fr: 'Test de découpe',
    ar: 'قص تجريبي'
  },
  'Customer preview': {
    fr: 'Aperçu client',
    ar: 'معاينة العميل'
  },
  'Export Mimaki Job Folder': {
    fr: 'Exporter le dossier de travail Mimaki',
    ar: 'تصدير مجلد عمل Mimaki'
  },
  'Export a single format': {
    fr: 'Exporter un seul format',
    ar: 'تصدير صيغة واحدة'
  },
  'Export EPS CutContour Only': {
    fr: 'Exporter EPS CutContour seul',
    ar: 'تصدير EPS CutContour فقط'
  },
  'Output type': {
    fr: 'Type de sortie',
    ar: 'نوع المخرجات'
  },
  'Production layers': {
    fr: 'Calques de production',
    ar: 'طبقات الإنتاج'
  },
  'Registration marks': {
    fr: 'Repères de positionnement',
    ar: 'علامات التسجيل'
  },
  'Canvas guides': {
    fr: 'Guides du plan de travail',
    ar: 'أدلة مساحة التصميم'
  },
  'Mask / Crop': {
    fr: 'Masque / recadrage',
    ar: 'قناع / اقتصاص'
  },
  'Create Cutline from Mask': {
    fr: 'Créer le contour depuis le masque',
    ar: 'إنشاء خط قص من القناع'
  },
  'Stickers per sheet': {
    fr: 'Stickers par feuille',
    ar: 'الملصقات لكل ورقة'
  },
  'Per sheet': {
    fr: 'Par feuille',
    ar: 'لكل ورقة'
  },
  All: {
    fr: 'Tout',
    ar: 'الكل'
  },
  Roll: {
    fr: 'Rouleau',
    ar: 'الرول'
  },
  Objects: {
    fr: 'Objets',
    ar: 'العناصر'
  },
  'Lock aspect ratio': {
    fr: 'Verrouiller les proportions',
    ar: 'قفل نسبة الأبعاد'
  },
  'Duplicate preset': {
    fr: 'Dupliquer le préréglage',
    ar: 'تكرار الإعداد المسبق'
  },
  Shortcuts: {
    fr: 'Raccourcis',
    ar: 'الاختصارات'
  },
  View: {
    fr: 'Vue',
    ar: 'العرض'
  },
  'No cutline': {
    fr: 'Aucun contour de découpe',
    ar: 'لا يوجد خط قص'
  },
  'Order by': {
    fr: 'Commander par',
    ar: 'الطلب حسب'
  },
  'Material length': {
    fr: 'Longueur du matériau',
    ar: 'طول المادة'
  },
  'Target sheet': {
    fr: 'Feuille cible',
    ar: 'الورقة المستهدفة'
  },
  'Allow rotation': {
    fr: 'Autoriser la rotation',
    ar: 'السماح بالتدوير'
  },
  Add: {
    fr: 'Ajouter',
    ar: 'إضافة'
  },
  'Start with your artwork': {
    fr: 'Commencez par votre visuel',
    ar: 'ابدأ بتصميمك'
  },
  'Keyboard shortcuts': {
    fr: 'Raccourcis clavier',
    ar: 'اختصارات لوحة المفاتيح'
  },
  Properties: {
    fr: 'Propriétés',
    ar: 'الخصائص'
  },
  'Mask / trim': {
    fr: 'Masque / rognage',
    ar: 'قناع / تشذيب'
  },
  'Trim rectangle': {
    fr: 'Rectangle de rognage',
    ar: 'مستطيل التشذيب'
  },
  'Oval mask': {
    fr: 'Masque ovale',
    ar: 'قناع بيضاوي'
  },
  'Apply mask / trim': {
    fr: 'Appliquer le masque / rognage',
    ar: 'تطبيق القناع / التشذيب'
  },
  'Release mask': {
    fr: 'Retirer le masque',
    ar: 'إزالة القناع'
  },
  'Create cut line': {
    fr: 'Créer un contour de découpe',
    ar: 'إنشاء خط قص'
  },
  'Cut around mask': {
    fr: 'Découper autour du masque',
    ar: 'قص حول القناع'
  },
  'Cut around artwork': {
    fr: 'Découper autour du visuel',
    ar: 'قص حول التصميم'
  },
  'Use selected shape': {
    fr: 'Utiliser la forme sélectionnée',
    ar: 'استخدام الشكل المحدد'
  },
  'Save piece preset': {
    fr: 'Enregistrer le préréglage de pièce',
    ar: 'حفظ إعداد القطعة'
  },
  'Sticker Job': {
    fr: 'Travail de stickers',
    ar: 'طلب ملصقات'
  },
  Sticker: {
    fr: 'Sticker',
    ar: 'ملصق'
  },
  'Import Artwork': {
    fr: 'Importer un visuel',
    ar: 'استيراد التصميم'
  },
  'Import PDF / AI Pages': {
    fr: 'Importer des pages PDF / AI',
    ar: 'استيراد صفحات PDF / AI'
  },
  'Import Folder': {
    fr: 'Importer un dossier',
    ar: 'استيراد مجلد'
  },
  'PDF production inspection': {
    fr: 'Inspection de production PDF',
    ar: 'فحص إنتاج PDF'
  },
  Filter: {
    fr: 'Filtrer',
    ar: 'تصفية'
  },
  'Add selected': {
    fr: 'Ajouter la sélection',
    ar: 'إضافة المحدد'
  },
  'Arrange selected': {
    fr: 'Disposer la sélection',
    ar: 'ترتيب المحدد'
  },
  'Delete unused': {
    fr: 'Supprimer les éléments inutilisés',
    ar: 'حذف غير المستخدم'
  },
  'By metre': {
    fr: 'Par mètre',
    ar: 'بالمتر'
  },
  'Vertical length (m)': {
    fr: 'Longueur verticale (m)',
    ar: 'الطول العمودي (م)'
  },
  'Preflight Check': {
    fr: 'Contrôle avant production',
    ar: 'فحص ما قبل الإنتاج'
  },
  Preflight: {
    fr: 'Contrôle avant production',
    ar: 'فحص ما قبل الإنتاج'
  },
  'Production safety checks before export.': {
    fr: 'Vérifications de production avant l’export.',
    ar: 'فحوصات سلامة الإنتاج قبل التصدير.'
  },
  'No obvious production problems detected.': {
    fr: 'Aucun problème de production évident détecté.',
    ar: 'لم يتم اكتشاف مشاكل إنتاج واضحة.'
  },
  'Sheet Usage': {
    fr: 'Utilisation de la feuille',
    ar: 'استخدام الورقة'
  },
  'Artwork / stickers': {
    fr: 'Visuels / stickers',
    ar: 'التصاميم / الملصقات'
  },
  'Finished width (mm)': {
    fr: 'Largeur finie (mm)',
    ar: 'العرض النهائي (مم)'
  },
  'Cut line': {
    fr: 'Contour de découpe',
    ar: 'خط القص'
  },
  'Quantity / metres': {
    fr: 'Quantité / mètres',
    ar: 'الكمية / الأمتار'
  },
  'Order by copies or metres': {
    fr: 'Commander en copies ou en mètres',
    ar: 'الطلب بالنسخ أو بالأمتار'
  },
  '1. Prepare artwork': {
    fr: '1. Préparer le visuel',
    ar: '1. إعداد التصميم'
  },
  '2. Cut lines': {
    fr: '2. Contours de découpe',
    ar: '2. خطوط القص'
  },
  '3. Quantities': {
    fr: '3. Quantités',
    ar: '3. الكميات'
  },
  '4. Layout & export': {
    fr: '4. Mise en page et export',
    ar: '4. التخطيط والتصدير'
  },
  'Print preview (hide editing overlays)': {
    fr: 'Aperçu d’impression (masquer les aides)',
    ar: 'معاينة الطباعة (إخفاء أدوات التحرير)'
  },
  'Previous step': {
    fr: 'Étape précédente',
    ar: 'الخطوة السابقة'
  },
  'Plain back cover': {
    fr: 'Dos de couverture uni',
    ar: 'غلاف خلفي سادة'
  },
  'Batch students': {
    fr: 'Lot d’étudiants',
    ar: 'مجموعة الطلاب'
  },
  'Import CSV': {
    fr: 'Importer un CSV',
    ar: 'استيراد CSV'
  },
  'Add student': {
    fr: 'Ajouter un étudiant',
    ar: 'إضافة طالب'
  },
  'Add students manually or import a CSV file.': {
    fr: 'Ajoutez les étudiants ou importez un fichier CSV.',
    ar: 'أضف الطلاب يدويًا أو استورد ملف CSV.'
  },
  'Customer mockup': {
    fr: 'Maquette client',
    ar: 'نموذج معاينة العميل'
  },
  'Lightweight approval preview.': {
    fr: 'Aperçu léger pour validation.',
    ar: 'معاينة خفيفة للموافقة.'
  },
  'Mockup view': {
    fr: 'Vue de la maquette',
    ar: 'عرض النموذج'
  },
  'Flat sheet': {
    fr: 'Feuille à plat',
    ar: 'ورقة مسطحة'
  },
  'Folded hardcover': {
    fr: 'Couverture rigide pliée',
    ar: 'غلاف صلب مطوي'
  },
  'Spine check': {
    fr: 'Vérification du dos',
    ar: 'فحص كعب الكتاب'
  },
  'Front cover': {
    fr: 'Couverture avant',
    ar: 'الغلاف الأمامي'
  },
  'Back cover': {
    fr: 'Couverture arrière',
    ar: 'الغلاف الخلفي'
  },
  Drag: {
    fr: 'Glisser',
    ar: 'سحب'
  },
  'Upload mémoire PDF': {
    fr: 'Importer le PDF du mémoire',
    ar: 'رفع PDF المذكرة'
  },
  'Upload front PDF': {
    fr: 'Importer le PDF avant',
    ar: 'رفع PDF الغلاف الأمامي'
  },
  'Upload back PDF': {
    fr: 'Importer le PDF arrière',
    ar: 'رفع PDF الغلاف الخلفي'
  },
  'No PDF yet': {
    fr: 'Aucun PDF pour le moment',
    ar: 'لا يوجد PDF بعد'
  },
  'PDF placement': {
    fr: 'Placement du PDF',
    ar: 'موضع PDF'
  },
  Structure: {
    fr: 'Structure',
    ar: 'الهيكل'
  },
  Margin: {
    fr: 'Marge',
    ar: 'الهامش'
  },
  'Save as default': {
    fr: 'Enregistrer par défaut',
    ar: 'حفظ كإعداد افتراضي'
  },
  'Update preset': {
    fr: 'Mettre à jour le préréglage',
    ar: 'تحديث الإعداد المسبق'
  },
  'Reset factory': {
    fr: 'Réinitialiser les réglages d’origine',
    ar: 'استعادة إعدادات المصنع'
  },
  'Independent cover PDFs': {
    fr: 'PDF de couvertures indépendants',
    ar: 'ملفات PDF مستقلة للأغلفة'
  },
  'Back cover source': {
    fr: 'Source de la couverture arrière',
    ar: 'مصدر الغلاف الخلفي'
  },
  'Jump to page': {
    fr: 'Aller à la page',
    ar: 'الانتقال إلى الصفحة'
  },
  'Cover templates': {
    fr: 'Modèles de couverture',
    ar: 'قوالب الغلاف'
  },
  Accent: {
    fr: 'Couleur d’accent',
    ar: 'اللون البارز'
  },
  'Save template file': {
    fr: 'Enregistrer le fichier modèle',
    ar: 'حفظ ملف القالب'
  },
  'Print-ready export': {
    fr: 'Export prêt à imprimer',
    ar: 'تصدير جاهز للطباعة'
  },
  'Preview quality': {
    fr: 'Qualité d’aperçu',
    ar: 'جودة المعاينة'
  },
  'JPG Preview': {
    fr: 'Aperçu JPG',
    ar: 'معاينة JPG'
  },
  'Print Final': {
    fr: 'Impression finale',
    ar: 'طباعة نهائية'
  },
  'Production Guide': {
    fr: 'Guide de production',
    ar: 'دليل الإنتاج'
  },
  'Customer Preview': {
    fr: 'Aperçu client',
    ar: 'معاينة العميل'
  },
  'Decorative line': {
    fr: 'Ligne décorative',
    ar: 'خط زخرفي'
  },
  'Text direction': {
    fr: 'Sens du texte',
    ar: 'اتجاه النص'
  },
  'Top to bottom': {
    fr: 'De haut en bas',
    ar: 'من الأعلى إلى الأسفل'
  },
  'Bottom to top': {
    fr: 'De bas en haut',
    ar: 'من الأسفل إلى الأعلى'
  },
  'Auto-fit text to spine': {
    fr: 'Ajuster le texte au dos',
    ar: 'ملاءمة النص لكعب الكتاب تلقائيًا'
  },
  'Font size': {
    fr: 'Taille de police',
    ar: 'حجم الخط'
  },
  'Use main title': {
    fr: 'Utiliser le titre principal',
    ar: 'استخدام العنوان الرئيسي'
  },
  'Rotate direction': {
    fr: 'Inverser le sens',
    ar: 'تغيير اتجاه الدوران'
  },
  'Use custom spine color': {
    fr: 'Utiliser une couleur de dos personnalisée',
    ar: 'استخدام لون مخصص للكعب'
  },
  'Color swatch': {
    fr: 'Échantillon de couleur',
    ar: 'عينة اللون'
  },
  'Pick from design': {
    fr: 'Choisir dans le visuel',
    ar: 'اختيار من التصميم'
  },
  'Spine placement': {
    fr: 'Placement du dos',
    ar: 'موضع الكعب'
  },
  'Top: academic year': {
    fr: 'Haut : année universitaire',
    ar: 'الأعلى: السنة الدراسية'
  },
  'Middle: mémoire title': {
    fr: 'Milieu : titre du mémoire',
    ar: 'الوسط: عنوان المذكرة'
  },
  'Bottom: student name': {
    fr: 'Bas : nom de l’étudiant',
    ar: 'الأسفل: اسم الطالب'
  },
  'Discard Changes': {
    fr: 'Abandonner les modifications',
    ar: 'تجاهل التغييرات'
  },
  'Production workflow': {
    fr: 'Processus de production',
    ar: 'مسار الإنتاج'
  },
  Source: {
    fr: 'Source',
    ar: 'المصدر'
  },
  'Load mockup': {
    fr: 'Charger la maquette',
    ar: 'تحميل النموذج'
  },
  'Discard unsaved changes?': {
    fr: 'Abandonner les modifications non enregistrées ?',
    ar: 'تجاهل التغييرات غير المحفوظة؟'
  },
  'This action cannot be undone.': {
    fr: 'Cette action est irréversible.',
    ar: 'لا يمكن التراجع عن هذا الإجراء.'
  },
  'Discard changes': {
    fr: 'Abandonner les modifications',
    ar: 'تجاهل التغييرات'
  },
  'Keep editing': {
    fr: 'Continuer la modification',
    ar: 'متابعة التحرير'
  },
  'Unsaved changes': {
    fr: 'Modifications non enregistrées',
    ar: 'تغييرات غير محفوظة'
  },
  'Recovered unsaved project found': {
    fr: 'Projet non enregistré récupéré',
    ar: 'تم العثور على مشروع غير محفوظ للاسترداد'
  },
  Discard: {
    fr: 'Abandonner',
    ar: 'تجاهل'
  },
  'Open Autosave Folder': {
    fr: 'Ouvrir le dossier de sauvegarde automatique',
    ar: 'فتح مجلد الحفظ التلقائي'
  },
  Checklist: {
    fr: 'Liste de contrôle',
    ar: 'قائمة الفحص'
  },
  Total: {
    fr: 'Total',
    ar: 'الإجمالي'
  },
  Deposit: {
    fr: 'Acompte',
    ar: 'العربون'
  },
  Remaining: {
    fr: 'Reste',
    ar: 'المتبقي'
  },
  'Snap to 1 mm': {
    fr: 'Aligner sur 1 mm',
    ar: 'محاذاة إلى 1 مم'
  },
  'Add number': {
    fr: 'Ajouter un numéro',
    ar: 'إضافة رقم'
  },
  'Add fixed text': {
    fr: 'Ajouter un texte fixe',
    ar: 'إضافة نص ثابت'
  },
  Left: {
    fr: 'Gauche',
    ar: 'يسار'
  },
  Center: {
    fr: 'Centre',
    ar: 'وسط'
  },
  Right: {
    fr: 'Droite',
    ar: 'يمين'
  },
  'Remove position': {
    fr: 'Supprimer la position',
    ar: 'إزالة الموضع'
  },
  'PDF page': {
    fr: 'Page PDF',
    ar: 'صفحة PDF'
  },
  'Print at actual size (100%).': {
    fr: 'Imprimez à la taille réelle (100 %).',
    ar: 'اطبع بالحجم الفعلي (100%).'
  },
  'Cancel PDF preparation': {
    fr: 'Annuler la préparation du PDF',
    ar: 'إلغاء إعداد PDF'
  },
  'Start new project': {
    fr: 'Créer un nouveau projet',
    ar: 'بدء مشروع جديد'
  },
  Setup: {
    fr: 'Configuration',
    ar: 'الإعداد'
  },
  'Single-sided · no back page': {
    fr: 'Recto seul · sans verso',
    ar: 'وجه واحد · بدون خلف'
  },
  'Double-sided · blank back': {
    fr: 'Recto verso · verso vierge',
    ar: 'وجهان · خلف فارغ'
  },
  'Double-sided · back design': {
    fr: 'Recto verso · visuel au verso',
    ar: 'وجهان · تصميم خلفي'
  },
  'Repeat the same number on the back': {
    fr: 'Répéter le même numéro au verso',
    ar: 'تكرار الرقم نفسه على الخلف'
  },
  'Flip on long edge': {
    fr: 'Retourner sur le bord long',
    ar: 'القلب على الحافة الطويلة'
  },
  'Flip on short edge': {
    fr: 'Retourner sur le bord court',
    ar: 'القلب على الحافة القصيرة'
  },
  'Rotate sheet': {
    fr: 'Tourner la feuille',
    ar: 'تدوير الورقة'
  },
  Notes: {
    fr: 'Notes',
    ar: 'ملاحظات'
  },
  Job: {
    fr: 'Travail',
    ar: 'طلب'
  },
  Project: {
    fr: 'Projet',
    ar: 'مشروع'
  },
  Customer: {
    fr: 'Client',
    ar: 'العميل'
  },
  Status: {
    fr: 'État',
    ar: 'الحالة'
  },
  Balance: {
    fr: 'Solde',
    ar: 'الرصيد'
  },
  'Balance:': {
    fr: 'Solde :',
    ar: 'الرصيد:'
  },
  'Deadline:': {
    fr: 'Échéance :',
    ar: 'الموعد:'
  },
  'All statuses': {
    fr: 'Tous les états',
    ar: 'كل الحالات'
  },
  'Clear filters': {
    fr: 'Effacer les filtres',
    ar: 'مسح عوامل التصفية'
  },
  'Search jobs': {
    fr: 'Rechercher des travaux',
    ar: 'البحث في الطلبات'
  },
  'Search customers': {
    fr: 'Rechercher des clients',
    ar: 'البحث في العملاء'
  },
  'Search exports': {
    fr: 'Rechercher des exports',
    ar: 'البحث في عمليات التصدير'
  },
  'Clear search': {
    fr: 'Effacer la recherche',
    ar: 'مسح البحث'
  },
  'Customer database': {
    fr: 'Base de clients',
    ar: 'قاعدة بيانات العملاء'
  },
  'Customer details, order history, and outstanding balances stay on this computer.': {
    fr: 'Les clients, commandes et soldes restent sur cet ordinateur.',
    ar: 'تبقى بيانات العملاء وسجل الطلبات والأرصدة على هذا الحاسوب.'
  },
  'Customer and production': {
    fr: 'Client et production',
    ar: 'العميل والإنتاج'
  },
  'Saved customer': {
    fr: 'Client enregistré',
    ar: 'عميل محفوظ'
  },
  'New or unlinked customer': {
    fr: 'Client nouveau ou non lié',
    ar: 'عميل جديد أو غير مرتبط'
  },
  'Production tool': {
    fr: 'Outil de production',
    ar: 'أداة الإنتاج'
  },
  Booklet: {
    fr: 'Livret',
    ar: 'كتيب'
  },
  Cutter: {
    fr: 'Découpe',
    ar: 'قص'
  },
  Hardcover: {
    fr: 'Couverture rigide',
    ar: 'غلاف صلب'
  },
  'Quote and payment': {
    fr: 'Devis et paiement',
    ar: 'عرض السعر والدفع'
  },
  'Production notes': {
    fr: 'Notes de production',
    ar: 'ملاحظات الإنتاج'
  },
  'Cancel editing': {
    fr: 'Annuler la modification',
    ar: 'إلغاء التحرير'
  },
  'Copy quote': {
    fr: 'Copier le devis',
    ar: 'نسخ عرض السعر'
  },
  'Delete this shop job?': {
    fr: 'Supprimer ce travail ?',
    ar: 'حذف هذا الطلب؟'
  },
  'Keep job': {
    fr: 'Garder le travail',
    ar: 'الاحتفاظ بالطلب'
  },
  'Delete job': {
    fr: 'Supprimer le travail',
    ar: 'حذف الطلب'
  },
  'Delete customer?': {
    fr: 'Supprimer le client ?',
    ar: 'حذف العميل؟'
  },
  'Keep customer': {
    fr: 'Garder le client',
    ar: 'الاحتفاظ بالعميل'
  },
  'Delete customer': {
    fr: 'Supprimer le client',
    ar: 'حذف العميل'
  },
  'Return to today': {
    fr: 'Revenir à aujourd’hui',
    ar: 'العودة إلى اليوم'
  },
  'No jobs': {
    fr: 'Aucun travail',
    ar: 'لا توجد طلبات'
  },
  'All jobs': {
    fr: 'Tous les travaux',
    ar: 'كل الطلبات'
  },
  'Your production queue': {
    fr: 'Votre file de production',
    ar: 'قائمة الإنتاج الخاصة بك'
  },
  'Keep things moving': {
    fr: 'Faites avancer le travail',
    ar: 'حافظ على سير العمل'
  },
  'Task guide': {
    fr: 'Guide des tâches',
    ar: 'دليل المهام'
  },
  'Tell us what you’re making. Find your tools and a clear place to start.': {
    fr: 'Dites-nous ce que vous produisez pour trouver les bons outils et commencer.',
    ar: 'أخبرنا بما تنتجه للعثور على الأدوات المناسبة ونقطة البداية.'
  },
  Successful: {
    fr: 'Réussi',
    ar: 'ناجح'
  },
  Failed: {
    fr: 'Échoué',
    ar: 'فشل'
  },
  Canceled: {
    fr: 'Annulé',
    ar: 'ملغى'
  },
  'Open File': {
    fr: 'Ouvrir le fichier',
    ar: 'فتح الملف'
  },
  'Open Folder': {
    fr: 'Ouvrir le dossier',
    ar: 'فتح المجلد'
  },
  'Copy Path': {
    fr: 'Copier le chemin',
    ar: 'نسخ المسار'
  },
  'Open tool': {
    fr: 'Ouvrir l’outil',
    ar: 'فتح الأداة'
  },
  'Local export history. Customer artwork is never copied into this log.': {
    fr: 'Historique local des exports. Les visuels clients ne sont jamais copiés dans ce journal.',
    ar: 'سجل تصدير محلي. لا تُنسخ تصاميم العملاء إلى هذا السجل.'
  },
  'Command Center': {
    fr: 'Centre de commandes',
    ar: 'مركز الأوامر'
  },
  Current: {
    fr: 'Actuel',
    ar: 'الحالي'
  },
  Dismiss: {
    fr: 'Fermer',
    ar: 'إغلاق'
  },
  'Cancel and Fix': {
    fr: 'Annuler et corriger',
    ar: 'إلغاء وإصلاح'
  },
  'Workspace access': {
    fr: 'Accès à l’espace de travail',
    ar: 'الوصول إلى مساحة العمل'
  },
  'Create account': {
    fr: 'Créer un compte',
    ar: 'إنشاء حساب'
  },
  'Sign in': {
    fr: 'Se connecter',
    ar: 'تسجيل الدخول'
  },
  Subscription: {
    fr: 'Abonnement',
    ar: 'الاشتراك'
  },
  'Continue with Google': {
    fr: 'Continuer avec Google',
    ar: 'المتابعة باستخدام Google'
  },
  'Cancel Google sign-in': {
    fr: 'Annuler la connexion Google',
    ar: 'إلغاء تسجيل الدخول باستخدام Google'
  },
  'Forgot password?': {
    fr: 'Mot de passe oublié ?',
    ar: 'نسيت كلمة المرور؟'
  },
  Email: {
    fr: 'E-mail',
    ar: 'البريد الإلكتروني'
  },
  Password: {
    fr: 'Mot de passe',
    ar: 'كلمة المرور'
  },
  'New password': {
    fr: 'Nouveau mot de passe',
    ar: 'كلمة مرور جديدة'
  },
  'Email code': {
    fr: 'Code reçu par e-mail',
    ar: 'رمز البريد الإلكتروني'
  },
  'Send recovery code': {
    fr: 'Envoyer le code de récupération',
    ar: 'إرسال رمز الاسترداد'
  },
  'Verify email with a code': {
    fr: 'Vérifier l’e-mail avec un code',
    ar: 'التحقق من البريد الإلكتروني برمز'
  },
  'Shop name': {
    fr: 'Nom de l’atelier',
    ar: 'اسم المطبعة'
  },
  'Requested plan': {
    fr: 'Formule demandée',
    ar: 'الباقة المطلوبة'
  },
  Message: {
    fr: 'Message',
    ar: 'الرسالة'
  },
  'Tools included in your subscription': {
    fr: 'Outils inclus dans votre abonnement',
    ar: 'الأدوات المشمولة في اشتراكك'
  },
  'Latest request:': {
    fr: 'Dernière demande :',
    ar: 'آخر طلب:'
  },
  'Maher will review your request. This page updates automatically.': {
    fr: 'Maher examinera votre demande. Cette page se met à jour automatiquement.',
    ar: 'سيراجع ماهر طلبك. تُحدّث هذه الصفحة تلقائيًا.'
  },
  'Tell Maher about your shop and the access you need. No payment is required.': {
    fr: 'Présentez votre atelier à Maher et indiquez l’accès souhaité. Aucun paiement requis.',
    ar: 'أخبر ماهر عن مطبعتك والوصول الذي تحتاجه. لا يلزم دفع أي مبلغ.'
  },
  'Check account access': {
    fr: 'Vérifier l’accès au compte',
    ar: 'التحقق من الوصول إلى الحساب'
  },
  'Preparing workspace access…': {
    fr: 'Préparation de l’accès…',
    ar: 'جارٍ إعداد الوصول إلى مساحة العمل…'
  },
  'Checking your local account and subscription status.': {
    fr: 'Vérification du compte local et de l’abonnement.',
    ar: 'جارٍ التحقق من حسابك المحلي وحالة الاشتراك.'
  },
  'Activate Subscription Key': {
    fr: 'Activer la clé d’abonnement',
    ar: 'تفعيل مفتاح الاشتراك'
  },
  'Subscription Key': {
    fr: 'Clé d’abonnement',
    ar: 'مفتاح الاشتراك'
  },
  'Local Record': {
    fr: 'Enregistrement local',
    ar: 'السجل المحلي'
  },
  'Manage Subscription': {
    fr: 'Gérer l’abonnement',
    ar: 'إدارة الاشتراك'
  },
  'Access Status': {
    fr: 'État de l’accès',
    ar: 'حالة الوصول'
  },
  'Current Plan:': {
    fr: 'Formule actuelle :',
    ar: 'الباقة الحالية:'
  },
  'Trial ends': {
    fr: 'Fin de l’essai',
    ar: 'انتهاء التجربة'
  },
  Plan: {
    fr: 'Formule',
    ar: 'الباقة'
  },
  Tools: {
    fr: 'Outils',
    ar: 'الأدوات'
  },
  Actions: {
    fr: 'Actions',
    ar: 'الإجراءات'
  },
  'Refresh inbox': {
    fr: 'Actualiser les demandes',
    ar: 'تحديث الطلبات'
  },
  'Subscription plans and tools': {
    fr: 'Formules et outils',
    ar: 'باقات الاشتراك والأدوات'
  },
  'Pending requests': {
    fr: 'Demandes en attente',
    ar: 'طلبات معلّقة'
  },
  'No requests awaiting review.': {
    fr: 'Aucune demande à examiner.',
    ar: 'لا توجد طلبات تنتظر المراجعة.'
  },
  'Loading requests…': {
    fr: 'Chargement des demandes…',
    ar: 'جارٍ تحميل الطلبات…'
  },
  Approve: {
    fr: 'Approuver',
    ar: 'موافقة'
  },
  'Give trial': {
    fr: 'Accorder un essai',
    ar: 'منح تجربة'
  },
  Deny: {
    fr: 'Refuser',
    ar: 'رفض'
  },
  'Accounts and access': {
    fr: 'Comptes et accès',
    ar: 'الحسابات والوصول'
  },
  'Find a customer': {
    fr: 'Trouver un client',
    ar: 'البحث عن عميل'
  },
  Access: {
    fr: 'Accès',
    ar: 'الوصول'
  },
  Ends: {
    fr: 'Fin',
    ar: 'الانتهاء'
  },
  'Manage subscription': {
    fr: 'Gérer l’abonnement',
    ar: 'إدارة الاشتراك'
  },
  'Grant / reinstate': {
    fr: 'Accorder / rétablir',
    ar: 'منح / إعادة تفعيل'
  },
  Trial: {
    fr: 'Essai',
    ar: 'تجربة'
  },
  Extend: {
    fr: 'Prolonger',
    ar: 'تمديد'
  },
  Revoke: {
    fr: 'Révoquer',
    ar: 'إلغاء الوصول'
  },
  'Recent decisions': {
    fr: 'Décisions récentes',
    ar: 'القرارات الأخيرة'
  },
  'Tool access': {
    fr: 'Accès aux outils',
    ar: 'الوصول إلى الأدوات'
  },
  'Custom tools for this customer': {
    fr: 'Outils personnalisés pour ce client',
    ar: 'أدوات مخصصة لهذا العميل'
  },
  'Include for this customer': {
    fr: 'Inclure pour ce client',
    ar: 'تضمين لهذا العميل'
  },
  'Exclude for this customer': {
    fr: 'Exclure pour ce client',
    ar: 'استبعاد لهذا العميل'
  },
  'Reason / note': {
    fr: 'Motif / note',
    ar: 'السبب / الملاحظة'
  },
  'Release, storage, licensing, exports, and performance diagnostics.': {
    fr: 'Diagnostics de version, stockage, licence, exports et performances.',
    ar: 'تشخيص الإصدار والتخزين والترخيص والتصدير والأداء.'
  },
  'Reading local app health…': {
    fr: 'Lecture de l’état local…',
    ar: 'جارٍ قراءة حالة التطبيق المحلية…'
  },
  'Available tools': {
    fr: 'Outils disponibles',
    ar: 'الأدوات المتاحة'
  },
  'Open App Data Folder': {
    fr: 'Ouvrir le dossier de données',
    ar: 'فتح مجلد بيانات التطبيق'
  },
  'Export Diagnostic Report': {
    fr: 'Exporter le rapport de diagnostic',
    ar: 'تصدير تقرير التشخيص'
  },
  'Clear Temporary Cache': {
    fr: 'Vider le cache temporaire',
    ar: 'مسح الذاكرة المؤقتة'
  },
  'Reset Local Trial / License': {
    fr: 'Réinitialiser l’essai / la licence locale',
    ar: 'إعادة ضبط التجربة / الترخيص المحلي'
  },
  'Create Test Projects': {
    fr: 'Créer des projets de test',
    ar: 'إنشاء مشاريع تجريبية'
  },
  'Unknown date': {
    fr: 'Date inconnue',
    ar: 'تاريخ غير معروف'
  },
  'Create booklet imposition from PDF or images': {
    fr: 'Créer une imposition de livret à partir d’un PDF ou d’images',
    ar: 'إنشاء مونتاج كتيب من PDF أو صور'
  },
  'Number tickets, invoices, and forms with cut-stack order and aligned backs': {
    fr: 'Numéroter tickets, factures et formulaires avec ordre de coupe et versos alignés',
    ar: 'ترقيم التذاكر والفواتير والنماذج بترتيب القص وأوجه خلفية متطابقة'
  },
  'Generate graduation or mémoire cover sheets with spine and layout guides': {
    fr: 'Créer des couvertures de mémoire avec dos et guides de mise en page',
    ar: 'إنشاء أغلفة التخرج أو المذكرات مع الكعب وأدلة التخطيط'
  },
  'Prepare print layer and cutline sheets for plotter/cutter with precision and efficiency': {
    fr: 'Préparer les calques d’impression et de découpe pour traceur avec précision',
    ar: 'إعداد طبقة الطباعة وأوراق خطوط القص بدقة وكفاءة'
  },
  'Repeat AI, PDF, or image business cards on A4 with zero gaps, custom spacing, or auto 8.8 × 5.6 cm sizing':
    {
      fr: 'Répéter des cartes AI, PDF ou image sur A4 sans espace, avec espacement personnalisé ou taille auto de 8,8 × 5,6 cm',
      ar: 'تكرار بطاقات AI أو PDF أو الصور على A4 بدون فراغات أو بمسافات مخصصة أو بحجم تلقائي 8.8 × 5.6 سم'
    }
}
