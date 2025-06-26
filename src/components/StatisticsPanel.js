import React from "react";

function StatisticsPanel({
  greaterPercent = 0,
  greaterCount = 0,
  lessPercent = 0,
  lessCount = 0,
  equalPercent = 0,
  equalCount = 0,
  onDownloadAll,
  onDownloadLess,
  onDownloadGreater,
}) {
  return (
    <div className="bg-white rounded-xl shadow p-4 w-full">
      <h2 className="font-bold text-lg text-[#1A237E] mb-4">Statistics</h2>
      <div className="flex flex-col gap-3 mb-4">
        {/* Greater than standard */}
        <div className="rounded-lg border-l-4 border-green-400 bg-green-50 p-3">
          <div className="text-xs text-green-800 font-semibold">Greater than standard</div>
          <div className="text-2xl font-bold text-green-500">{greaterPercent}%</div>
          <div className="text-xs text-green-800">{greaterCount} Plantation</div>
        </div>
        {/* Less than standard */}
        <div className="rounded-lg border-l-4 border-orange-400 bg-orange-50 p-3">
          <div className="text-xs text-orange-800 font-semibold">Less than standard</div>
          <div className="text-2xl font-bold text-orange-500">{lessPercent}%</div>
          <div className="text-xs text-orange-800">{lessCount} Plantation</div>
        </div>
        {/* Equal to standard */}
        <div className="rounded-lg border-l-4 border-blue-400 bg-blue-50 p-3">
          <div className="text-xs text-blue-800 font-semibold">Equal to standard</div>
          <div className="text-2xl font-bold text-blue-500">{equalPercent}%</div>
          <div className="text-xs text-blue-800">{equalCount} Plantation</div>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <button
          onClick={onDownloadAll}
          className="flex items-center justify-center gap-2 bg-[#1A237E] text-white font-semibold py-2 rounded-lg hover:bg-[#283593] transition"
        >
          <span className="material-icons">file_download</span>
          Download All Data as Excel
        </button>
        <button
          onClick={onDownloadLess}
          className="flex items-center justify-center gap-2 border border-orange-400 text-orange-600 font-semibold py-2 rounded-lg bg-white hover:bg-orange-50 transition"
        >
          <span className="material-icons">file_download</span>
          Download Less Than Standard
        </button>
        <button
          onClick={onDownloadGreater}
          className="flex items-center justify-center gap-2 border border-green-400 text-green-600 font-semibold py-2 rounded-lg bg-white hover:bg-green-50 transition"
        >
          <span className="material-icons">file_download</span>
          Download Greater Than Standard
        </button>
      </div>
    </div>
  );
}

export default StatisticsPanel;
