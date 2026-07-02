mediaplay-encode
================

A command line utility to encode video files into an html5 video and SmartTV/DLNA friendly format.

Under the hood, it wraps ffmpeg to encode almost any input video format into an opinionated, pre-defined output
format that should work on most browsers and SmartTVs

Installation
------------

```bash
npm i -g mediaplay-encode
```

Usage
-----

```bash
Usage: mediaplay-encode [options] [path]

Options:
  -V, --version                           output the version number
  --debug                                 Enable debug output
  --delete-source                         Permanently removes source file after encoding (default: false)
  -p, --preview                           Encode only 10s, for previewing the result (default: false)
  -e, --extensions [extension...]         Comma separated list of extensions to encode from (default: "f4v,mov,flv,swf,rm,avi,mkv,mp4,m4v,wmv,mpeg,asf,divx,mpg,ts")
  -x, --exclude-pattern <excludePattern>  Exclude files matching this regular expression (default: "\\.enc1\\.")
  -s, --encoded-suffix <suffix>           Add this suffix to the target file name (default: ".enc1")
  -l, --loop-interval <seconds>           When no files are found loop every <seconds> instead of terminating (default: 0)
  -d, --work-dir <dir>                    Temporary work directory for encoding process (default: "")
  -o, --one                               Process only one file and terminate, instead of processing all files (default: false)
  -t, --timeout <timeout>                 Timeout for ffmpeg/ffprobe commands (e.g. '4h', '30m', '60s', '500ms') (default: "")
  -P, --no-progress                       Disable interactive encoding progress output
  --lock-dir <dir>                        Directory used to store encode lock files
  --lock-stale-timeout <timeout>          Age after which lock files are considered stale (e.g. '7d', '24h') (default: "7d")
  --work-stale-timeout <timeout>          Age after which tmp/work files are considered stale (e.g. '7d', '24h') (default: "7d")
  -h, --help                              display help for command
```
