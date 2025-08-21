document.getElementById('startBtn').addEventListener('click', async () => {
  const draftInput = document.getElementById('draftInput').value.trim();
  const draftId = draftInput.match(/(\d{10,})/)?.[1];
  if (!draftId) return alert('Invalid draft ID');

  document.getElementById('startBtn').disabled = true;
  document.getElementById('stopBtn').disabled = false;

  await poll(draftId);
  timer.interval = setInterval(() => poll(draftId), 10000); // 10s interval
});

document.getElementById('stopBtn').addEventListener('click', () => {
  clearInterval(timer.interval);
  document.getElementById('startBtn').disabled = false;
  document.getElementById('stopBtn').disabled = true;
});

