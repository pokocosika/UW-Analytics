export function renderWorkloadCharts(summary) {
  const barCanvas = document.getElementById('workload-bar-chart');
  const pieCanvas = document.getElementById('workload-pie-chart');

  if (!barCanvas || !pieCanvas) return;

  const chartData = summary || [];
  const labels = chartData.map((item) => item.uw);
  const values = chartData.map((item) => item.currentWeight);
  const pieValues = chartData.map((item) => item.currentWeight || 0);

  if (window.workloadBarChartInstance) {
    window.workloadBarChartInstance.destroy();
  }

  if (window.workloadPieChartInstance) {
    window.workloadPieChartInstance.destroy();
  }

  window.workloadBarChartInstance = new Chart(barCanvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Current Weight',
        data: values,
        backgroundColor: 'rgba(255,140,0,0.75)',
        borderColor: '#ff8c00',
        borderWidth: 1,
        borderRadius: 6,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true },
      },
    },
  });

  window.workloadPieChartInstance = new Chart(pieCanvas.getContext('2d'), {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        data: pieValues,
        backgroundColor: ['#ff6b35', '#ff8c00', '#ffb347', '#ffd166', '#34d399', '#60a5fa', '#f472b6'],
        borderWidth: 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right' },
      },
    },
  });
}
