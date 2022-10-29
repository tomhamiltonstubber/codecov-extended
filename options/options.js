console.log('goo')

// Saves options to chrome.storage
function save_options() {
  const covered_colour = document.getElementById('covered-colour').value
  const uncovered_colour = document.getElementById('uncovered-colour').value
  const partial_colour = document.getElementById('partial-colour').value
  chrome.storage.sync.set({
    covered_colour: covered_colour,
    uncovered_colour: uncovered_colour,
    partial_colour: partial_colour,
  }, function () {
    // Update status to let user know options were saved.
    const save_button = document.getElementById('save');
    console.log('Saved')
    save_button.innerText = 'Saved!'
    setTimeout(function() {
      save_button.innerText = 'Save'
    }, 750);
  });
}

// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
function restore_options() {
  // Use default value color = 'red' and likesColor = true.
  chrome.storage.sync.get({
    covered_colour: '#48d361',
    uncovered_colour: '#e79191',
    partial_colour: 'yellow',
  }, function(items) {
    document.getElementById('covered-colour').value = items.covered_colour
    document.getElementById('uncovered-colour').value = items.uncovered_colour
    document.getElementById('partial-colour').value = items.partial_colour
  });
}
document.addEventListener('DOMContentLoaded', restore_options)
document.getElementById('save').addEventListener('click', save_options)
