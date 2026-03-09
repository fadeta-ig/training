const hugeicons = require('hugeicons-react');
const names = Object.keys(hugeicons);

function check(name) {
    const found = names.find(n => n.toLowerCase() === name.toLowerCase());
    if (found) {
        console.log(`${name} -> MATCH: ${found}`);
    } else {
        // Try to find a substring match
        const alt = names.find(n => n.toLowerCase().includes(name.replace(/[0-9]|Icon/g, '').toLowerCase()));
        console.log(`${name} -> NOT FOUND. Suggestion: ${alt || 'None'}`);
    }
}

const list = [
    'Menu01Icon', 'Cancel01Icon', 'DashboardSquare01Icon', 'Book02Icon',
    'Cube01Icon', 'Calendar03Icon', 'Camera01Icon', 'UserCircleIcon',
    'Notification02Icon', 'Play03Icon', 'TimeQuarterToIcon', 'DiplomaIcon',
    'Mortarboard02Icon', 'Rocket02Icon', 'LockKeyIcon', 'Tick01Icon',
    'PlayStartIcon', 'UsersGroupIcon', 'ArrowRight01Icon', 'BookOpen01Icon',
    'Edit02Icon'
];

list.forEach(check);
