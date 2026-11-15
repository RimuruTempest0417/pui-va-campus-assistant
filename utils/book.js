const { dateTimeText } = require('./date');
const i18n = require('./i18n');

/**
 * 圖書館的顯示轉換（W-66）
 *
 * 為什麼要一支共用檔：清單、詳情、我的借閱三個頁面都要顯示「可借／借完」「逾期 N 天」
 * 「候補第 N 位」。三個地方各寫一次，遲早出現清單說可借、詳情說借完。
 * 這裡只做顯示（不判斷能不能借）——能不能借永遠是後端的答案。
 */

/** 這本書現在能不能借：可借量 > 0 且沒有被候補留書佔滿 */
function availability(book) {
  const b = book || {};
  if (b.status === 'ARCHIVED') return { label: i18n.pick('已下架'), tag: 'neutral', borrowable: false };
  if (!b.availableCopies) return { label: i18n.pick('借完了'), tag: 'warning', borrowable: false };
  if (b.borrowable === false) return { label: i18n.pick('已留書'), tag: 'tint', borrowable: false };
  return { label: i18n.pick('可借') + ' ' + b.availableCopies, tag: 'success', borrowable: true };
}

/** 書名第一個字當縮圖徽章（沒有封面圖時用；比彩色 emoji 穩定，也比空白方塊好看） */
function initial(book) {
  const title = String((book && book.title) || '').trim();
  return title ? title.slice(0, 1) : i18n.pick('書');
}

function decorateBook(book) {
  if (!book) return book;
  const a = availability(book);
  return Object.assign({}, book, {
    initial: initial(book),
    availLabel: a.label,
    availTag: a.tag,
    borrowable: a.borrowable,
    metaText: [book.author, book.category].filter(Boolean).join(' · '),
    stockText: i18n.pick('可借') + ' ' + (book.availableCopies || 0) + ' / ' + (book.totalCopies || 0),
    waitingText: book.waiting ? i18n.pick('候補 ') + book.waiting + i18n.pick(' 位') : '',
    callText: book.callNumber ? i18n.pick('索書號 ') + book.callNumber : '',
  });
}

/** 借閱狀態：正常／快到期／已逾期；已還的標「已歸還」 */
function decorateLoan(loan) {
  if (!loan) return loan;
  const days = Number(loan.overdueDays) || 0;
  let label;
  let tag;
  if (loan.returnedAt) {
    label = i18n.pick('已歸還');
    tag = 'neutral';
  } else if (days > 0) {
    label = i18n.pick('逾期 ') + days + i18n.pick(' 天');
    tag = 'danger';
  } else if (loan.dueSoon) {
    label = i18n.pick('快到期');
    tag = 'warning';
  } else {
    label = i18n.pick('借閱中');
    tag = 'tint';
  }
  return Object.assign({}, loan, {
    statusLabel: label,
    statusTag: tag,
    dueText: loan.dueAt ? i18n.pick('應還 ') + dateTimeText(loan.dueAt) : '',
    borrowedText: loan.borrowedAt ? i18n.pick('借於 ') + dateTimeText(loan.borrowedAt) : '',
    /**
     * 續借鈕：已還、已續借過、已逾期都不給（後端也會擋，這裡只是不要讓人白按）。
     * 有沒有排隊要按了才知道（那要即時資料），所以不在此判斷。
     */
    canRenew: !loan.returnedAt && !days && !(Number(loan.renewals) >= 1),
  });
}

function decorateReservation(rv) {
  if (!rv) return rv;
  const ready = rv.status === 'READY';
  return Object.assign({}, rv, {
    ready: ready,
    statusLabel: ready ? i18n.pick('已留書，請到圖書館借出') : i18n.pick('候補第 ') + (rv.position || 0) + i18n.pick(' 位'),
    statusTag: ready ? 'success' : 'tint',
    hint: ready
      ? i18n.pick('保留 ') + (rv.holdHours || 48) + i18n.pick(' 小時，逾時讓給下一位')
      : i18n.pick('有人還書就會通知你'),
  });
}

module.exports = { availability, initial, decorateBook, decorateLoan, decorateReservation };
