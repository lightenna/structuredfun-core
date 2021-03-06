<?php

namespace Lightenna\StructuredBundle\Tests\Controller;

use Symfony\Bundle\FrameworkBundle\Test\WebTestCase;
use Lightenna\StructuredBundle\Controller\ViewController;
use Lightenna\StructuredBundle\DependencyInjection\FileReader;
use Lightenna\StructuredBundle\DependencyInjection\Constantly;

class FileReaderTest extends WebTestCase
{

    public function testSplitPathLeaf()
    {
        $t = new ViewController();
        $fr = new FileReader($t->convertRawToFilename('/structured/tests/data'));
        // test basic file split
        $this->assertEquals($fr->splitPathLeaf('fish/fowl.ext'), array('fish', 'fowl.ext'));
        // test zip split
        $this->assertEquals($fr->splitPathLeaf('fish.zip/fowl.ext'), array('fish.zip', 'fowl.ext'));
        // test basic no file
        $this->assertEquals($fr->splitPathLeaf('fish'), array('fish', null));
        // test basic no file with slash
        $this->assertEquals($fr->splitPathLeaf('fish/'), array('fish/', null));
        // test file no path
        $this->assertEquals($fr->splitPathLeaf('fish.ext'), array('', 'fish.ext'));
        // test multi-part path file split
        $this->assertEquals($fr->splitPathLeaf('fish/guppi/cod/herring/fowl.ext'), array('fish/guppi/cod/herring', 'fowl.ext'));
        // test multi-part path no file split
        $this->assertEquals($fr->splitPathLeaf('fish/guppi/cod/herring'), array('fish/guppi/cod/herring', null));
    }

    public function testGetFilenameFileReader()
    {
        $t = new ViewController();
        $fr = new FileReader($t->convertRawToFilename('/structured/tests/data'));
        $this->assertEquals($fr->getFilename(), $t->convertRawToFilename('/structured/tests/data'));
        // read first entry in standard folder
        $fr = new FileReader($t->convertRawToFilename('/structured/testshare/'), $t);
        $this->assertEquals($fr->getFilename(), $t->convertRawToFilename('/structured/testshare'));
        // read first entry in zip folder
        $fr = new FileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip'), $t);
        $this->assertEquals($fr->getFilename(), $t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip'));
        // read first entry in folder inside zip folder
        $fr = new FileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/nested'), $t);
        $this->assertEquals($fr->getFilename(), $t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip'));
        // get listing for a single file
        $fr = new FileReader($t->convertRawToFilename('/structured/tests/data/10-file_folder/00980001.JPG'), $t);
        $this->assertEquals($fr->getFilename(), $t->convertRawToFilename('/structured/tests/data/10-file_folder/00980001.JPG'));
        // get listing for a single file in a zip
        $fr = new FileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/00980002.JPG'), $t);
        $this->assertEquals($fr->getFilename(), $t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip'));
        // get listing for a single file in a nested folder in a zip
        $fr = new FileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/nested/00980007.JPG'), $t);
        $this->assertEquals($fr->getFilename(), $t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip'));
        // get listing for a single file, but strip arguments
        $fr = new FileReader($t->convertRawToFilename('/structured/tests/data/10-file_folder/00980001.JPG' . Constantly::ARG_SEPARATOR . 'arg1=v1&arg2=v2'), $t);
        $this->assertEquals($fr->getFilename(), $t->convertRawToFilename('/structured/tests/data/10-file_folder/00980001.JPG'));
    }

    public function testExcludedFile()
    {
        $t = new ViewController();
        $fr = new FileReader($t->convertRawToFilename('/structured/tests/data/10-file_folder/'), $t);
        $listing = $fr->getListing();
        $this->assertEquals(true, count($listing) > 0);
        foreach ($listing as $key => $entry) {
            $this->assertNotEquals($entry->getName(), Constantly::DIR_METADATA_FILENAME);
        }
    }

    public function testIndexRead()
    {
        $t = new ViewController();
        $fr = new FileReader($t->convertRawToFilename('/structured/tests/data/10-file_folder/'), $t);
        $listing_slash = $fr->getListing();
        // check we got entries
        $this->assertEquals(true, count($listing_slash) > 0);
        $fr = new FileReader($t->convertRawToFilename('/structured/tests/data/10-file_folder/' . Constantly::DIR_INDEX_FILENAME), $t);
        $listing_index = $fr->getListing();
        // check we got the same entries
        $this->assertEquals(true, count($listing_index) > 0);
        $this->assertEquals(count($listing_slash), count($listing_index));
        $this->assertEquals(reset($listing_slash)->getName(), reset($listing_index)->getName());
    }

    public function testProtectChangeIntoAndSplit()
    {
        // check that no change to short filenames, don't create directories
        $original_name = 'C:/small/file/path/with/filename.txt';
        $this->assertEquals($original_name, FileReader::protectChangeIntoAndSplit($original_name, false));
        // find safe path to write directories to
        $t = new ViewController();
        $prepend = $t->convertRawToFilename('/structured/tests/data/60-file_output_folder/');
        // long filename above limit
        $original_name = $prepend . '/long/next_is_100_chars/0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789/next_is_100_chars/0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789/next_is_100_chars/0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789/file/path/with/filename.txt';
        $this->assertGreaterThan(Constantly::DIR_LONGFILENAMEMAX, strlen($original_name));
        // if we tell it to create, we should get back a shorter filename
        $returned_filename = FileReader::protectChangeIntoAndSplit($original_name, true);
        $this->assertLessThan(Constantly::DIR_LONGFILENAMEMAX, strlen($returned_filename));
        $smaller_split = '0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789/next_is_100_chars/0123456789012345678901234567890123456789012345678901234567890123456789012345678901234567890123456789/file/path/with/filename.txt';
        $this->assertEquals($smaller_split, $returned_filename);
        // if we tell it not to create, it should be there already and still return
        $this->assertEquals($smaller_split, FileReader::protectChangeIntoAndSplit($original_name, false));
    }

}
