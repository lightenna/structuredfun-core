<?php

namespace Lightenna\StructuredBundle\DependencyInjection;

class Constantly
{

    const SFUN_VERSION = '0.9.9';
    const DIR_SEPARATOR_URL = '/';
    const DIR_SEPARATOR_ALIAS = '~2F';
    const DIR_METADATA_FILENAME = 'desktop.ini';
    const DIR_METADATA_SECTION = '.ShellClassInfo';
    const DIR_INDEX_FILENAME = 'index.html';
    const DIR_LONGFILENAMEMAX = 256;   // 260 is Windows limit
    const IMAGE_METADATA_FILENAME = 'metadata.json';
    const IMAGE_DEFAULT_FILENAME = 'native.img';
    const IMAGE_DEFAULT_FILENAME_EXT = 'img';
    const IMAGE_ERROR_FILENAME = 'htdocs/web/chrome/images/fullres/missing_image.jpg';
    const IMAGE_TRANSPARENT_FILENAME = 'htdocs/web/chrome/images/fullres/transparent.png';
    const IMAGE_STATUS_ERROR = -2;     // unable to open image at all
    const IMAGE_STATUS_DIRECTORY = -2; // entry is a directory
    const IMAGE_STATUS_MISSING = -1;   // cached image not found
    const IMAGE_STATUS_PENDING = 0;    // image waiting to load
    const IMAGE_STATUS_LOADED = 1;     // image thumbnail loaded
    const IMAGE_STATUS_RERESED = 2;    // image loaded and re-resed
    const FILETYPES_IMAGE = 'png,jpeg,jpg,gif,img';
    const FILETYPES_VIDEO = 'mp4,m4v,avi,flv,wmv,mpg';
    const FILETYPES_ZIP = 'zip';
    const FILEENT_SKIPLIST = 'directory,genfile';
    const DEFAULT_TIMECODE = '00-00-10.0';
    const DEFAULT_LAYOUT_DIRECTION = 'x';
    const DEFAULT_LAYOUT_BREADTH = 2;
    const CACHE_FILEEXT = 'dat';
    const FOLDER_NAME = 'structured';
    const LINK_NAME = 'fun.lnk';
    const ZIP_EXTMATCH = 'zip';
    const ZIP_SEPARATOR = '/';
    const ARG_SEPARATOR = '~args&';
    const FILEARG_SEPARATOR = '~';
    const RESBRACKET = 250;
    const RESTHRESHOLD = 8000;
    const SORT_NONE = 0;
    const SORT_AZ = 1;
    const SORT_ZA = 2;
    const SORT_RND = 3;
    const TILE_SHOWCACHETINT = true;
    const FILE_MAINTAINREADLIST = true;
    const MAXITERATIONS = 15;
}
