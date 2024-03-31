const params = new URLSearchParams(window.location.search);
const msg = params.get('msg');
if (msg) {
    document.getElementById('message').textContent = msg;
}

document.getElementById('memoForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    const content = document.getElementById('memoContent').value;
    const userId = localStorage.getItem('userId');

    try {
        const response = await fetch('/memo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, content }),
        });

        if (response.ok) {
            document.getElementById('memoContent').value = ''; // Clear textarea
            fetchAndDisplayMemos(); // Refresh the list of memos
        } else {
            console.error('Memo upload failed');
        }
    } catch (error) {
        console.error('Error uploading memo:', error);
    }
});

async function fetchAndDisplayMemos() {
    const userId = localStorage.getItem('userId');
    try {
        const response = await fetch(`/memos?userId=${userId}`);
        const memos = await response.json();

        const memosContainer = document.getElementById('memos');
        memosContainer.innerHTML = '';

        memos.forEach(memo => {
            const memoElement = document.createElement('div');
            memoElement.textContent = memo.content;
            memosContainer.appendChild(memoElement);
        });
    } catch (error) {
        console.error('Error fetching memos:', error);
    }
}

fetchAndDisplayMemos();
