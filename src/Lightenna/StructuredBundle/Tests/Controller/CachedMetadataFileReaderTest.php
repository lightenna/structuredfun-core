<?php

namespace Lightenna\StructuredBundle\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Lightenna\StructuredBundle\Controller\ViewController;
use Lightenna\StructuredBundle\DependencyInjection\CachedMetadataFileReader;
use Lightenna\StructuredBundle\DependencyInjection\Constantly;

class CachedMetadataFileReaderTest extends WebTestCase
{

    public function testGetFilenameCachedMetadataFileReaderNotUsingCache()
    {
        $t = new ViewController();
        // get filename for standard folder
        $mfr = new CachedMetadataFileReader($t->convertRawToFilename('/structured/tests/data'), $t);
        $this->assertEquals($mfr->getFilename(), $t->convertRawToFilename('/structured/tests/data'));
        // get filename for zip folder
        $mfr = new CachedMetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip'), $t);
        $this->assertEquals($mfr->getFilename(), $t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip'));
        // get filename for folder inside zip folder
        $mfr = new CachedMetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/nested'), $t);
        $this->assertEquals($mfr->getFilename(), $t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip'));
        // get filename for a single file
        $mfr = new CachedMetadataFileReader($t->convertRawToFilename('/structured/tests/data/10-file_folder/00980001.JPG'), $t);
        $this->assertEquals($mfr->getFilename(), $t->convertRawToFilename('/structured/tests/data/10-file_folder/00980001.JPG'));
        // get filename for a single file in a zip
        $mfr = new CachedMetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/00980002.JPG'), $t);
        $this->assertEquals($mfr->getFilename(), $t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip'));
        // get filename for a single file in a nested folder in a zip
        $mfr = new CachedMetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/nested/00980007.JPG'), $t);
        $this->assertEquals($mfr->getFilename(), $t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip'));
        // get filename for a single file, but strip arguments
        $mfr = new CachedMetadataFileReader($t->convertRawToFilename('/structured/tests/data/10-file_folder/00980001.JPG' . Constantly::ARG_SEPARATOR . 'arg1=v1&arg2=v2'), $t);
        $this->assertEquals($mfr->getFilename(), $t->convertRawToFilename('/structured/tests/data/10-file_folder/00980001.JPG'));
    }

    public function testGetFilenameCachedMetadataFileReaderUsingCache()
    {
        $t = new ViewController();
        // get uncacheable thing (standard folder)
        $mfr = new CachedMetadataFileReader($t->convertRawToFilename('/structured/tests/data'), $t);
        $this->assertEquals($mfr->getFilename(true), $t->convertRawToFilename('/structured/tests/data'));
        // read uncacheable thing (zip itself)
        $mfr = new CachedMetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip'), $t);
        $this->assertEquals($mfr->getFilename(true), $t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip'));
        // read uncacheable thing (directory in zip)
        $mfr = new CachedMetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/nested'), $t);
        $this->assertEquals($mfr->getFilename(true), $t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip'));
        // get listing for a single file
        $mfr = new CachedMetadataFileReader($t->convertRawToFilename('/structured/tests/data/10-file_folder/00980001.JPG'), $t);
        $this->assertEquals($mfr->getFilename(true),
            $mfr->getCachePath() . Constantly::DIR_SEPARATOR_URL .
            CachedMetadataFileReader::hash(
                $t->convertRawToFilename('/structured/tests/data/10-file_folder/00980001.JPG')
            ) .
            '.dat'
        );
        // get listing for a single file in a zip
        $mfr = new CachedMetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/00980002.JPG'), $t);
        $this->assertEquals($mfr->getFilename(true),
            $mfr->getCachePath() . Constantly::DIR_SEPARATOR_URL .
            CachedMetadataFileReader::hash(
                $t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/00980002.JPG')
            ) .
            '.dat'
        );
        // get listing for a single file in a nested folder in a zip
        $mfr = new CachedMetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/nested/00980007.JPG'), $t);
        $this->assertEquals($mfr->getFilename(true),
            $mfr->getCachePath() . Constantly::DIR_SEPARATOR_URL .
            CachedMetadataFileReader::hash(
                $t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/nested/00980007.JPG')
            ) .
            '.dat'
        );
        // get listing for a single file, but strip filtered arguments
        $mfr = new CachedMetadataFileReader($t->convertRawToFilename('/structured/tests/data/10-file_folder/00980001.JPG' . Constantly::ARG_SEPARATOR . 'arg1=v1&arg2=v2'), $t);
        $this->assertEquals($mfr->getFilename(true),
            $mfr->getCachePath() . Constantly::DIR_SEPARATOR_URL .
            CachedMetadataFileReader::hash(
                $t->convertRawToFilename('/structured/tests/data/10-file_folder/00980001.JPG')
            ) .
            '.dat'
        );
    }

}
