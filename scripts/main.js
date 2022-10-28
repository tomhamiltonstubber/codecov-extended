const uncovered = '#e79191'
const covered = '#48d361'
const partial = 'yellow'

// We need to save some variables globally as they all get wiped if the user minimises a file's diff
let gbl_row_totals = {}
let problem_lines = {}
let all_tables_expanded = false
let max_trs_expanded = 0


function get_tables () {
  const tbody = document.querySelector('tbody[data-testid="body-row"]')
  if (tbody) {
    return document.querySelectorAll('tbody[data-testid="body-row"] > table')
  } else {
    return []
  }
}

function get_rows () {
  const tbody = document.querySelector('tbody[data-testid="body-row"]')
  if (tbody) {
    return tbody.children
  } else {
    return []
  }
}

function get_trs () {
  const tbody = document.querySelector('tbody[data-testid="body-row"]')
  if (tbody) {
    return document.querySelectorAll('tbody[data-testid="body-row"] > tr')
  } else {
    return []
  }
}

function expand_tables () {
  // The first thing we need to do is expand all tables, otherwise we don't have access to any coverage data.
  function _expand_tables () {
    const rows = get_trs()
    if (rows.length) {
      for (let i = 0; i < rows.length ; i++) {
        let row = rows[i]
        const patch_percent = row.children.item(2).querySelector('span[data-testid="number-value"]')
        const change_percent = row.children.item(3).querySelector('div[data-testid="change-value"]')
        if (change_percent && change_percent.innerText !== '-' && patch_percent && patch_percent.innerText !== '100.00%') {
          let _row = document.querySelector('tbody').querySelectorAll('tr')[i]
          _row.querySelector('div[data-testid="name-expand"]').click()
          max_trs_expanded ++
        }
      }
      all_tables_expanded = true
    } else {
      setTimeout(() => {
        _expand_tables()
      }, 200)
    }
  }
  _expand_tables()
}

function _hash_string (s) {
  let hash = 0
  let i
  let chr
  if (s.length === 0) {
    return hash
  }
  for (i = 0; i < s.length; i++) {
    chr = s.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0
  }
  return Math.abs(hash)
}

function _process_problem_line (line, type, table) {
  const hash = _hash_string(line.innerText)
  if (!problem_lines[hash]) {
    problem_lines[hash] = {
      'string': line.innerText,
      'type': type,
      'table_id': table.id,
      'el_id': 'line_' + hash,
      'tr_id': table.getAttribute('tr_id'),
    }
  }
  return hash
}

function update_diff (table, update_totals) {
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
      line.id = 'line_' + _process_problem_line(code, 'partial', table)
      partial_count ++
    } else if (head.classList.contains('bg-ds-coverage-uncovered')) {
      master.style.background = head.style.background = code.style.background = uncovered
      line.id = 'line_' + _process_problem_line(code, 'uncovered', table)
      uncovered_count ++
    }
  }
  if (update_totals) {
    table.dataset.uncovered = uncovered_count
    table.dataset.partial = partial_count
  }
}

function process_table_lines (update_totals) {
  const tables = get_tables()
  if (tables.length) {
    if (tables.length) {
      for (let i = 0; i < tables.length; i++) {
        const table = tables[i]
        table.id = 'table_' + i
        update_diff(table, update_totals)
      }
    }
  }
}

function _add_extra_cell (tr, type) {
  let new_td = document.createElement('td')
  const classes_to_copy = tr.lastChild.classList
  new_td.classList.add(...Object.values(classes_to_copy))
  new_td.innerHTML = `<div class="w-full flex justify-end">
  <div class="font-semibold" style="background-color: ${type === 'partial' ? partial : uncovered}">
    <span id=${tr.id}_${type} class="font-lato">0</span>
  </div>
</div>`
  tr.lastChild.after(new_td)
}

function _row_is_expanded (row) {
  return row.nextSibling ? row.nextSibling.nodeName !== 'TR' : false
}

function _get_row_filename (row) {
  // This could change in future, let's hope it doesn't
  return row.querySelector('.break-all').innerText
}

function add_tr_extra_data () {
  const rows = get_trs()
  if (rows.length) {
    for (let i = 0; i < rows.length; i++) {
      const tr_row = rows[i]
      tr_row.id = 'tr_' + i
      tr_row.dataset.file_name = _get_row_filename(tr_row)
      _add_extra_cell(tr_row, 'partial')
      _add_extra_cell(tr_row, 'uncovered')
    }
  }
}

function add_table_tr_ids () {
  const tables = get_tables()
  if (tables.length) {
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i]
      let prev_sibling = table.previousSibling
      while (prev_sibling.nodeName !== 'TR') {
        prev_sibling = prev_sibling.previousSibling
      }
      table.setAttribute('tr_id', prev_sibling.id)
    }
  }
}

function add_row_totals () {
  let rows_to_update = {}
  const rows = get_rows()
  let current_tr_id
  if (rows.length) {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (row.dataset.row_processed === undefined) {
        if (row.nodeName === 'TR') {
          if (!_row_is_expanded(row) && gbl_row_totals[row.id]) {
            rows_to_update[row.id] = gbl_row_totals[row.id]
          }
          current_tr_id = row.id
        } else if (row.nodeName === 'TABLE') {
          if (current_tr_id in rows_to_update) {
            rows_to_update[current_tr_id].partial += parseInt(row.dataset.partial)
            rows_to_update[current_tr_id].uncovered += parseInt(row.dataset.uncovered)
          } else {
            rows_to_update[current_tr_id] = {
              partial: parseInt(row.dataset.partial),
              uncovered: parseInt(row.dataset.uncovered)
            }
          }
        }
        row.dataset.row_processed = 'row_processed'
      }
    }
  }
  return rows_to_update
}

function  update_tr_totals (tr_totals) {
  for (const row_id in tr_totals) {
    const row = tr_totals[row_id]
    const tr = document.getElementById(`tr_${row_id}`)
    if (tr && !tr.dataset.totals_added) {
      document.getElementById(`tr_${row_id}_partial`).innerText = row.partial
      document.getElementById(`tr_${row_id}_uncovered`).innerText = row.uncovered
      gbl_row_totals[row_id] = row
      tr.dataset.totals_added = 'totals_added'
    }
  }
}

function setup_table_diff_observer () {
  const t_observer = new MutationObserver(() => {
    process_table_lines(false)
  })
  t_observer.observe(document.body, {childList: true, subtree: true})
}

function _get_line_filename (line) {
  return document.getElementById(line.tr_id).dataset.file_name
}

function file_line_lookup () {
  let lookup = {}
  const lines = Object.values(problem_lines)
  lines.sort((a, b) => {
    return a.table_id - b.table_id
  })
  lines.forEach(line => {
    const file_name = _get_line_filename(line)
    if (lookup[file_name]) {
      lookup[file_name].push(line)
    } else {
      lookup[file_name] = [line]
    }
  })
  return lookup
}

function setup_line_links () {
  const lines_with_links = document.querySelectorAll('.line-link')
  console.log(lines_with_links)
  if (lines_with_links.length) {
    for (let i = 0; i < lines_with_links.length; i++) {
      const line = lines_with_links[i]
      line.onclick = e => {
        console.log('foo')
        e.preventDefault()
        document.getElementById(line.dataset.link).scrollIntoView()
      }
    }
  }
}

function update_sidebar () {
  const sidebar_body = document.getElementById('sidebar-body')
  let new_dl = document.createElement('dl')
  let dl_inner = ''
  const grouped_lines = file_line_lookup()
  for (const filename in grouped_lines) {
    const lines = grouped_lines[filename]
    dl_inner += `<dt class="font-semibold">${filename}</dt>`
    lines.forEach(line => {
      let text = line.string.trim()
      if (text[0] === '+' || text[0] === '-') {
        text = text.substring(1)
      }
      if (text.length > 75) {
        text = text.slice(0, 75) + '…'
      }
      let line_link
      const line_el = document.getElementById(line.line_id)
      if (line_el) {
        line_link = line_el.id
      } else {
        line_link = line.tr_id
      }
      dl_inner += `<dd class="pl-2 text-xs mt-0.5 text-ds-gray-quinary"><a data-link="${line_link}" href="" class="line-link">${text}</a></dd>`
    })
  }
  new_dl.innerHTML = dl_inner
  sidebar_body.append(new_dl)
  setup_line_links()
}

function post_tables_process () {
  // Checks that the max amount of rows has been loaded. Some rows take a while to load, and we can't do anything
  // until they have all loaded.
  let old_row_count = 0
  let same_count = 0
  function _wait_rows_expanded () {
    let new_row_count = get_trs().length || 0
    if (old_row_count === 0 || new_row_count !== old_row_count) {
      old_row_count = new_row_count
      setTimeout(function () {_wait_rows_expanded()}, 500)
    } else if (same_count < 4) {
      same_count ++
      setTimeout(function () {_wait_rows_expanded()}, 500)
    } else {
      console.log('Finished loading rows')
      add_tr_extra_data()
      add_table_tr_ids()
      process_table_lines(true)
      const tr_totals = add_row_totals()
      update_tr_totals(tr_totals)
      update_sidebar()
    // setup_table_diff_observer()
    }
  }
  _wait_rows_expanded()
}

function _add_extra_header (tr, title) {
  let new_th = document.createElement('th')
  new_th.innerHTML = `<div class="flex flex-row grow gap-1 items-center select-none">
  <span class="w-full text-right">${title}</span>
</div>`
  tr.lastChild.after(new_th)
}

function create_extra_headers () {
  function _create_extra_headers () {
    const header = document.querySelector('thead[data-testid="header-row"]')
    if (header) {
      const tr = header.children.item(0)
      _add_extra_header(tr, 'New partials')
      _add_extra_header(tr, 'New uncovered')
    } else {
      setTimeout(() => {
        _create_extra_headers()
      }, 500)
    }
  }
  _create_extra_headers()
}

function edit_commits_section () {
  function _edit_commits_section () {
    const aside = document.querySelector('aside')
    if (aside) {
      const head = aside.children.item(0).children.item(0)
      head.innerText = 'Partial/uncovered lines'
      const body = aside.children.item(0).children.item(1)
      body.id = 'sidebar-body'
      body.innerHTML = ''
    } else {
      setTimeout(() => {
        _edit_commits_section()
      }, 500)
    }
  }
  _edit_commits_section()
}

function remove_progress_bars () {
  const progress_bars = document.querySelectorAll('div[data-testid="org-progress-bar"]')
  if (progress_bars.length) {
    for (let i = 0; i < progress_bars.length ; i++) {
      progress_bars[i].parentElement.remove()
    }
  }
}


const pb_observer = new MutationObserver(remove_progress_bars)
pb_observer.observe(document.body, {childList: true, subtree: true})


create_extra_headers()
edit_commits_section()
expand_tables()
post_tables_process()
