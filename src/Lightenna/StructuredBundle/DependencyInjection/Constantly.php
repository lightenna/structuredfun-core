<?php

namespace Lightenna\StructuredBundle\DependencyInjection;

class Constantly
{

    const SFUN_VERSION = '0.9.5';
    const DIR_SEPARATOR_URL = '/';
    const DIR_SEPARATOR_ALIAS = '~dir~';
    const IMAGE_STATUS_ERROR = -2;     // unable to open image at all
    const IMAGE_STATUS_DIRECTORY = -2; // entry is a directory
    const IMAGE_STATUS_MISSING = -1;   // cached image not found
    const IMAGE_STATUS_PENDING = 0;    // image waiting to load
    const IMAGE_STATUS_LOADED = 1;     // image thumbnail loaded
    const IMAGE_STATUS_RERESED = 2;    // image loaded and re-resed
    const FILETYPES_IMAGE = 'png,jpeg,jpg,gif';
    const FILETYPES_VIDEO = 'mp4,m4v,avi,flv,wmv,mpg';
    const FILETYPES_ZIP = 'zip';
    const DEFAULT_TIMECODE = '00-00-10.0';
    const DEFAULT_LAYOUT_DIRECTION = 'x';
    const DEFAULT_LAYOUT_BREADTH = 2;
    const FOLDER_NAME = 'structured';
    const ZIP_EXTMATCH = 'zip';
    const ZIP_SEPARATOR = '/';
    const ARG_SEPARATOR = '~args&';
    const FILEARG_SEPARATOR = '~';

}
