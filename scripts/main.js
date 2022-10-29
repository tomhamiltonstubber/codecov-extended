let gbl_first_run = true
let gbl_lines = {}
let gbl_totals = {}

const dft_covered_colour = '#48d361'
const dft_uncovered_color = '#e79191'
const dft_partial_colour = 'yellow'
let covered_colour, uncovered_color, partial_colour

chrome.storage.sync.get({
  covered_colour: dft_covered_colour,
  uncovered_colour: dft_uncovered_color,
  partial_colour: dft_partial_colour,
}, function(items) {
  covered_colour = items.covered_colour
  uncovered_color = items.uncovered_colour
  partial_colour = items.partial_colour
});

// Utility functions

function debounce(func){
  let timer;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(() => { func.apply(this); }, 300);
  };
}

function get_tables () {
  const tbody = document.querySelector('tbody[data-testid="body-row"]')
  if (tbody) {
    return document.querySelectorAll('tbody[data-testid="body-row"] > table')
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

function _add_total_tr_cell (tr, type) {
  let new_td = document.createElement('td')
  const classes_to_copy = tr.lastChild.classList
  new_td.classList.add(...Object.values(classes_to_copy))
  new_td.innerHTML = (`
<div class="w-full flex justify-end">
  <div class="font-semibold" style="background-color: ${type === 'partial' ? partial_colour : uncovered_color}">
    <span id="${tr.id}_${type}" class="font-lato">0</span>
  </div>
</div>
`)
  tr.append(new_td)
}

function _get_row_filename (row) {
  // This could change in future, let's hope it doesn't
  return row.querySelector('.break-all').innerText
}

// Code that runs on first load and each time a file diff is expanded or collapsed

function _remove_progress_bars () {
  // The progress bars are really unnecessary IMO
  const progress_bars = document.querySelectorAll('div[data-testid="org-progress-bar"]')
  if (progress_bars.length) {
    for (let i = 0; i < progress_bars.length ; i++) {
      progress_bars[i].parentElement.remove()
    }
  }
}

function _add_tr_extra_data () {
  // Adding the extra data and cells to each `tr` to be filled later
  const rows = get_trs()
  if (rows.length) {
    for (let i = 0; i < rows.length; i++) {
      const tr_row = rows[i]
      if (!tr_row.id) {
        tr_row.id = 'tr_' + i
        tr_row.dataset.file_name = _get_row_filename(tr_row)
        _add_total_tr_cell(tr_row, 'partial')
        _add_total_tr_cell(tr_row, 'uncovered')
      }
    }
  }
}

function _add_table_tr_ids () {
  // Adding an id and tr_id to each `table` so that we can refer to it later
  const tables = get_tables()
  if (tables.length) {
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i]
      if (!table.dataset.tr_id) {
        let prev_sibling = table.previousSibling
        while (prev_sibling.nodeName !== 'TR') {
          prev_sibling = prev_sibling.previousSibling
        }
        table.dataset.tr_id = prev_sibling.id
        table.id = 'table_' + i
      }
    }
  }
}

function _process_line (line, line_number, type, table) {
  // Adds a new line to the `lines` object and returns the line's hash
  const hash = _hash_string(line.innerText, line_number)
  if (!gbl_lines[hash]) {
    gbl_lines[hash] = {
      text: line.innerText,
      type: type,
      bg_colour: type === 'partial' ? partial_colour : uncovered_color,
      table_id: table.id,
      el_id: 'line_' + hash,
      tr_id: table.dataset.tr_id,
      line_number: line_number
    }
  }
  return hash
}

function _process_table (table) {
  // Colours each uncovered/partial line and adds new lines to the `lines` object
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
    const line_number = head.children.item(0).innerText
    line.dataset.line_number = line_number
    if (operator && operator.innerText[0] === '-') {
      line.hidden = true
    } else if (head.classList.contains('bg-ds-coverage-covered')) {
      master.style.background = head.style.background = code.style.background = covered_colour
      covered_count ++
    } else if (head.classList.contains('bg-ds-coverage-partial')) {
      master.style.background = head.style.background = code.style.background = partial_colour
      line.id = 'line_' + _process_line(code, line_number, 'partial', table)
      partial_count ++
    } else if (head.classList.contains('bg-ds-coverage-uncovered')) {
      master.style.background = head.style.background = code.style.background = uncovered_color
      line.id = 'line_' + _process_line(code, line_number, 'uncovered', table)
      uncovered_count ++
    }
  }
  table.dataset.uncovered = uncovered_count.toString()
  table.dataset.partial = partial_count.toString()
}

function _process_tables () {
  // Processes each table to add the diff lines to it and update the totals if needed.
  const tables = get_tables()
  if (tables.length) {
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i]
      if (!table.dataset.unprocessed) {
        _process_table(table)
      }
    }
  }
}

function _process_totals () {
  // If first use, creates the `gbl_totals` object with totals for each file. Populates the extra `tr` cells with the totals.
  if (gbl_first_run) {
    const tables = get_tables()
    if (tables.length) {
      for (let i = 0; i < tables.length; i++) {
        const table = tables[i]
        if (!table.dataset.totals_processed) {
          const tr_id = table.dataset.tr_id
          if (gbl_totals[tr_id]) {
            gbl_totals[tr_id].partial += parseInt(table.dataset.partial)
            gbl_totals[tr_id].uncovered += parseInt(table.dataset.uncovered)
          } else {
            gbl_totals[tr_id] = {
              partial: parseInt(table.dataset.partial),
              uncovered: parseInt(table.dataset.uncovered)
            }
          }
          table.dataset.totals_processed = 'processed'
        }
      }
    }
  }
  const trs = get_trs()
  if (trs.length) {
    for (let i = 0; i < trs.length; i++) {
      const tr_row = trs[i]
      const row_totals = gbl_totals[tr_row.id]
      if (row_totals) {
        document.getElementById(`${tr_row.id}_partial`).innerText = row_totals.partial
        document.getElementById(`${tr_row.id}_uncovered`).innerText = row_totals.uncovered
      }
    }
  }
}

function _update_sidebar_links () {
  // Updates the sidebar links to point to the correct line. If the line is hidden (the diff is collapsed) then link
  // to the `tr` instead.
  const lines_with_links = document.querySelectorAll('.line-link')
  if (lines_with_links.length) {
    for (let i = 0; i < lines_with_links.length; i++) {
      const line = lines_with_links[i]
      line.onclick = e => {
        e.preventDefault()
        let line_el = document.getElementById(line.dataset.link)
        if (!line_el) {
          line_el = document.getElementById(line.dataset.tr_link)
        }
        line_el.scrollIntoView()
      }
    }
  }
}

const update_all = debounce(() => {
  _remove_progress_bars()
  _add_tr_extra_data()
  _add_table_tr_ids()
  _process_tables()
  _process_totals()
  if (!gbl_first_run) {
    _update_sidebar_links()
  }
})

// Creating and updating the sidebar

function _get_line_filename (line) {
  return document.getElementById(line.tr_id).dataset.file_name
}

function _file_line_lookup () {
  let lookup = {}
  const lines = Object.values(gbl_lines)
  lines.sort((a, b) => {
    return b.table_id - a.table_id || a.line_number - b.line_number
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

function _format_line_text (line) {
  let text = line.text
  if (text[0] === '+' || text[0] === '-') {
    text = text.substring(1)
  }
  text = text.trim()
  if (text.length > 50) {
    text = text.slice(0, 50) + '…'
  }
  return text
}

function _sidebar_totals_line (p_count, u_count) {
  return (`
<p>
  Total: <span style="background-color: ${partial_colour}">${p_count} partial</span> lines and <span style="background-color: ${uncovered_color}">${u_count} uncovered</span> lines
</p>
<p class="text-xs pb-4">Click on a line to jump to it.</p>
`)
}

function _sidebar_missed_line (line_link, line_tr_link, line_bg, line_text) {
  return (`
<dd class="pl-2 text-xs mt-0.5 text-ds-gray-quinary">
  <li>
    <a href="" data-link="${line_link}" data-tr_link="${line_tr_link}" class="line-link" style="background-color: ${line_bg}">${line_text}</a>
  </li>
</dd>
`)
}

function create_sidebar () {
  // Creates the sidebar with links to each missed item. Has to wait for the first_run to be finished.
  function _create_sidebar () {
    if (gbl_first_run) {
      setTimeout(function () {_create_sidebar()}, 500)
    } else {
      const grouped_lines = _file_line_lookup()
      let sidebar_body_html = ''
      let u_count = 0
      let p_count = 0
      for (const filename in grouped_lines) {
        const lines = grouped_lines[filename]
        sidebar_body_html += `<dt class="font-semibold">${filename}</dt>`
        lines.forEach(line => {
          const line_text = _format_line_text(line)
          const line_el = document.getElementById(line.el_id)
          let line_link = line_el ? line.el_id : line.tr_id
          let line_tr_link = line.tr_id
          if (line.type === 'uncovered') {
            u_count += 1
          } else {
            p_count += 1
          }
          sidebar_body_html += _sidebar_missed_line(line_link, line_tr_link, line.bg_colour, line_text)
        })
      }
      const aside = document.querySelector('aside')
      const sidebar_head = aside.children.item(0).children.item(0)
      sidebar_head.classList.remove('flex', 'pb-4')
      sidebar_head.innerHTML = _sidebar_totals_line(p_count, u_count)
      const sidebar_body = aside.children.item(0).children.item(1)
      sidebar_body.innerHTML = `<dl>${sidebar_body_html}</dl>`
      _update_sidebar_links()
    }
  }
  _create_sidebar()
}

// Code that just runs the first time we load the page

const _table_observer = (mutations) => {
  if (mutations && mutations.length > 0) {
    mutations.forEach(function (mutation) {
      if (mutation.addedNodes && mutation.addedNodes.length > 0) {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeName === 'TABLE') {
            update_all()
          }
        })
      } else {
        // We need to check if no tables are expanded and then update the rows with their totals again
        const tables = get_tables()
        if (!tables.length) {
          update_all()
        }
      }
    })
  }
}

function setup_table_diff_observer () {
  // Occurs when a file is expanded or collapsed. CodeCov regenerate everything so we have to run the code again.
  const t_observer = new MutationObserver(_table_observer)
  t_observer.observe(document.body, {childList: true, subtree: true})
}

function load_first_time () {
  // Checks that the max amount of rows has been loaded. Some rows take a while to load, and we can't do anything
  // until they have all loaded.
  let old_row_count = 0
  let same_count = 0
  function _load_first_time () {
    let new_row_count = get_trs().length || 0
    if (old_row_count === 0 || new_row_count !== old_row_count) {
      old_row_count = new_row_count
      setTimeout(function () {_load_first_time()}, 500)
    } else if (same_count < 4) {
      same_count ++
      setTimeout(function () {_load_first_time()}, 500)
    } else {
      console.log('Finished loading for first time')
      gbl_first_run = false
    }
  }
  _load_first_time()
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
        }
      }
    } else {
      setTimeout(() => {
        _expand_tables()
      }, 200)
    }
  }
  _expand_tables()
}

setup_table_diff_observer()
expand_tables()
load_first_time()
create_sidebar()
