const uncovered = '#e79191'
const covered = '#48d361'
const partial = 'yellow'

window.totals = {}


function debounce(func, timeout = 500){
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this, args); }, timeout);
  };
}

const update_totals = debounce(() => {
  const tbody = document.querySelector('tbody')
  if (tbody) {
    const tbody_children = tbody.children
    let last_tr = 0
    if (tbody_children.length) {
      for (let i = 0; i < tbody_children.length; i++) {
        const child = tbody_children[i]
        if (child.nodeName === 'TR') {
          last_tr ++
        } else if (child.nodeName === 'TABLE') {
          child.setAttribute('tr_id', last_tr)
        }
      }
    }
  }
})


const update_diff = (table) => {
  const lines = table.querySelectorAll('tr[data-testid="fv-diff-line"]')
  let uncovered_count = 0
  let covered_count = 0
  let partial_count = 0
  for (let i = 0; i < lines.length ; i++) {
    const line = lines[i]
    const master = line.children.item(0)
    const head = line.children.item(1)
    const code = line.children.item(2)
    const operator = code.querySelector('.token.operator')
    if (operator && operator.innerText[0] === '-') {
      line.hidden = true
    } else if (head.classList.contains('bg-ds-coverage-covered')) {
      master.style.background = head.style.background = code.style.background = covered
      covered_count ++
    } else if (head.classList.contains('bg-ds-coverage-partial')) {
      master.style.background = head.style.background = code.style.background = partial
      partial_count ++
    } else if (head.classList.contains('bg-ds-coverage-uncovered')) {
      master.style.background = head.style.background = code.style.background = uncovered
      uncovered_count ++
    }
  }
  table.setAttribute('data-uncovered', uncovered_count)
  table.setAttribute('data-partial', partial_count)
  return [partial_count, uncovered_count]
}

const table_observer = () => {
  const tables = document.querySelectorAll('.table-auto')
  if (tables.length) {
    for (let i = 0; i < tables.length ; i++) {
      const totals = update_diff(tables[i])
    }
  }
  update_totals()
}

const reset_file_headings = () => {
  const progress_bars = document.querySelectorAll('div[data-testid="org-progress-bar"]')
  if (progress_bars.length) {
    for (let i = 0; i < progress_bars.length ; i++) {
      progress_bars[i].parentElement.remove()
    }
  }
}

const expand_tables = () => {
  function _expand_tables () {
    const tbody = document.querySelector('tbody')
    if (tbody) {
      const rows = tbody.querySelectorAll('tr')
      for (let i = 0; i < rows.length ; i++) {
        let row = rows[i]
        const patch_percent = row.children.item(2).querySelector('span[data-testid="number-value"]').innerText
        // const row_title = row.children.item(0).querySelector('.text-xs').innerText
        // row.setAttribute('_file', row_title)
        if (patch_percent !== '100.00%') {
          let _row = tbody.querySelectorAll('tr')[i]
          _row.querySelector('div[data-testid="name-expand"]').click()
        }
      }
    } else {
      setTimeout(() => {
        _expand_tables()
      }, 500)
    }
  }
  _expand_tables()
}

const add_extra_header = (tr, title) => {
  let new_th = document.createElement('th')
  new_th.innerHTML = `<div class="flex flex-row grow gap-1 items-center select-none">
  <span class="w-full text-right">${title}</span>
</div>`
  tr.lastChild.after(new_th)
}

const create_extra_headers = () => {
  function _create_extra_headers () {
    const header = document.querySelector('thead[data-testid="header-row"]')
    if (header) {
      const tr = header.children.item(0)
      add_extra_header(tr, 'New partials')
      add_extra_header(tr, 'New uncovered')
    } else {
      setTimeout(() => {
        _create_extra_headers()
      }, 500)
    }
  }
  _create_extra_headers()
}

  // Waiting for jQuery to load
const t_observer = new MutationObserver(table_observer)
t_observer.observe(document.body, {childList: true, subtree: true})
const pb_observer = new MutationObserver(reset_file_headings)
pb_observer.observe(document.body, {childList: true, subtree: true})
create_extra_headers()
expand_tables()
