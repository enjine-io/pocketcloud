
//---------------------------------------------------------------------
// Script to start all index.js files found in immediate sub dirs of 
// the 'apps' folder using pm2.
//---------------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const pm2 = require('pm2');

// Directory containing subdirectories with index.js files
const baseDirectoryPath = '/app/data/files/apps';

// Connect to PM2
pm2.connect(function(err) {
  if (err) {
    console.error(err);
    process.exit(2);
  }

  // Retrieve a list of all applications currently managed by PM2
  pm2.list((err, processDescriptionList) => {
    if (err) {
      console.error('Failed to list PM2 processes:', err);
      pm2.disconnect(); // Make sure to disconnect from PM2
      process.exit(2);
    }

    const runningApps = processDescriptionList.map(process => process.name);

    // Read the base directory
    fs.readdir(baseDirectoryPath, function(err, entries) {
      if (err) {
        console.log('Unable to scan directory:', err);
        pm2.disconnect(); // Make sure to disconnect from PM2
        return;
      }

      if (entries.length === 0) {
        pm2.disconnect(); // Disconnect if there are no entries to process
        return;
      }

      let processedCount = 0;

      entries.forEach(function(entry) {
        const entryPath = path.join(baseDirectoryPath, entry);

        // Check if the entry is a directory
        fs.stat(entryPath, function(err, stat) {
          if (err) {
            console.log('Unable to stat entry:', err);
            checkCompletion(++processedCount, entries.length);
            return;
          }

          if (stat.isDirectory()) {
            // Check for an index.js file within the directory
            const indexPath = path.join(entryPath, 'index.js');
            fs.access(indexPath, fs.constants.F_OK, (err) => {
              if (!err) {
                // Check if the process is not already running
                if (!runningApps.includes(entry)) {
                  // Start the index.js file with PM2
                  pm2.start({
                    script: indexPath,
                    name: entry, // Naming the process after the directory
                  }, function(err) {
                    if (err) throw err;
                    console.log(`Started ${indexPath}`);
                    checkCompletion(++processedCount, entries.length);
                  });
                } else {
                  console.log(`The process for ${indexPath} is already running.`);
                  checkCompletion(++processedCount, entries.length);
                }
              } else {
                checkCompletion(++processedCount, entries.length);
              }
            });
          } else {
            checkCompletion(++processedCount, entries.length);
          }
        });
      });
    });
  });
});

function checkCompletion(processed, total) {
  if (processed === total) {
    pm2.disconnect(); // Disconnect from PM2 when all directories have been processed
    console.log('All processes checked. Exiting.');
    process.exit(0);
  }
}

