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
Usage: mediaplay-encode [options] [paths...]

Options:
  -V, --version                           output the version number
  -i, --high-quality                      Sacrifice cpu and/or disk space to get better quality
                                          (default: false)
  --debug                                 Enable debug output
  --delete-source                         Permanently removes source file after encoding (default:
                                          false)
  -p, --preview                           Encode only 10s, for previewing the result (default:
                                          false)
  -r, --reverse-order                     Prioritize encoding newer (by creation time) files
                                          (default: false)
  -e, --extensions [extension...]         Comma separated list of extensions to encode from
                                          (default:
                                          "f4v,mov,flv,rm,avi,mkv,mp4,m4v,wmv,mpeg,asf,divx,mpg")
  -x, --exclude-pattern <excludePattern>  Exclude files matching this regular expression (default:
                                          "\\.enc")
  -s, --encoded-suffix <suffix>           Add this suffix to the target file name (default: ".enc")
  -l, --loop-interval <seconds>           When no files are found loop every <seconds> instead of
                                          terminating (default: 0)
  -h, --help                              display help for command
```
