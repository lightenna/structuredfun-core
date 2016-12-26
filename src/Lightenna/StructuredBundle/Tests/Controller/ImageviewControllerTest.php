<?php

namespace Lightenna\StructuredBundle\Tests\Controller;

use Lightenna\StructuredBundle\Controller\ImageviewController;
use Lightenna\StructuredBundle\DependencyInjection\ImageTransform;
use Lightenna\StructuredBundle\DependencyInjection\CachedMetadataFileReader;
use Lightenna\StructuredBundle\DependencyInjection\MetadataFileReader;
use Lightenna\StructuredBundle\Entity\Arguments;
use Lightenna\StructuredBundle\Tests\DependencyInjection\BaseWebTestCase;
use Symfony\Component\HttpFoundation\Request;

class ImageviewControllerTest extends BaseWebTestCase
{

    public function testImageRoutes()
    {
        $identifier = CachedMetadataFileReader::hash('structured/tests/data/10-file_folder/00980001.JPG');
        $identifier .= '/full/!1024,679/0/native.img';
        $file_cache = $this->getCachedFileLocation('/image/' . $identifier);
        // fire request
        $imgdata = $this->fireRequestForContent('/image/' . $identifier, $file_cache);
        // check that cache entry generated
        $this->assertEquals(true, file_exists($file_cache));
        $this->fireRequestForContent('/imagenocache/' . $identifier, $file_cache);
        // check that cache entry is not generated (nocache)
        $this->assertEquals(false, file_exists($file_cache));
        $this->fireRequestForContent('/imagecacherefresh/' . $identifier, $file_cache);
        // check that cache entry generated
        $this->assertEquals(true, file_exists($file_cache));
    }

    public function testImageReturnedDimension()
    {
        $identifier = CachedMetadataFileReader::hash('structured/tests/data/10-file_folder/00980001.JPG');
        $identifier .= '/full/!1024,679/0/native.img';
        // fire request
        $imgdata = $this->fireRequestForContent('/imagecacherefresh/' . $identifier);
        $imgmeta = getimagesizefromstring($imgdata);
        $this->assertEquals(1024, $imgmeta[0]);
        $this->assertEquals(679, $imgmeta[1]);
    }

    public function testImageMetaReturnedDimension()
    {
        $identifier = CachedMetadataFileReader::hash('structured/tests/data/10-file_folder/00980001.JPG');
        // fire request
        $imgjson = $this->fireRequestForContent('/imagemeta/' . $identifier, null);
        $imgmeta = json_decode($imgjson);
        $this->assertEquals(1024, $imgmeta->metadata->loadedWidth);
        $this->assertEquals(679, $imgmeta->metadata->loadedHeight);
    }

    public function testImageCalcNewSize()
    {
        $dummy = '';
        $it = new ImageTransform(new Arguments(), $dummy);
        // setup vars for standard images
        $long = 500;
        $short = 400;
        $restricted = 200;
        // create standard input images
        $wide = imagecreatetruecolor($long, $short);
        $tall = imagecreatetruecolor($short, $long);
        // test width-limited landscape resize
        $it = new ImageTransform(new Arguments($restricted, null), $dummy);
        $it->imageCalcNewSize($wide);
        $this->assertEquals($it->getOutputWidth() == $restricted, true);
        $this->assertEquals($it->getOutputHeight() < $restricted, true);
        // test height-limited portrait resize
        $it = new ImageTransform(new Arguments(null, $restricted), $dummy);
        $it->imageCalcNewSize($tall);
        $this->assertEquals($it->getOutputWidth() < $restricted, true);
        $this->assertEquals($it->getOutputHeight() == $restricted, true);
        // test unrestricted resize
        $it = new ImageTransform(new Arguments(), $dummy);
        $it->imageCalcNewSize($wide);
        $this->assertEquals($it->getOutputWidth() == $long, true);
        $this->assertEquals($it->getOutputHeight() == $short, true);
        // test weird width-limited portrait resize
        $it = new ImageTransform(new Arguments($restricted, null), $dummy);
        $it->imageCalcNewSize($tall);
        $this->assertEquals($it->getOutputWidth() == $restricted, true);
        $this->assertEquals($it->getOutputHeight() > $restricted, true);
        // test width-limited landscape resize using longest
        $it = new ImageTransform(new Arguments($restricted, $restricted), $dummy);
        $it->imageCalcNewSize($wide);
        $this->assertEquals($it->getOutputWidth() == $restricted, true);
        $this->assertEquals($it->getOutputHeight() < $restricted, true);
        // test height-bound landscape resize using shortest
//        $it = new ImageTransform((object)array(
//            'maxshortest' => $restricted,
//        ), $dummy);
//        $it->imageCalcNewSize($wide);
//        $this->assertEquals($it->getOutputWidth() > $restricted, true);
//        $this->assertEquals($it->getOutputHeight() == $restricted, true);
        // test height-limited portrait resize using longest
        $it = new ImageTransform(new Arguments($restricted, $restricted), $dummy);
        $it->imageCalcNewSize($tall);
        $this->assertEquals($it->getOutputWidth() < $restricted, true);
        $this->assertEquals($it->getOutputHeight() == $restricted, true);
        // clean up images
        imagedestroy($wide);
        imagedestroy($tall);
    }

    public function testfilterImage()
    {
        $t = new ImageviewController();
        // setup vars for standard images
        $long = 500;
        $short = 400;
        $restricted = 200;
        // create standard input images
        $wide = imagecreatetruecolor($long, $short);
        $tall = imagecreatetruecolor($short, $long);
        // test raw clipping
        $t->setArgsByArray(array(
            'clipwidth' => $restricted,
            'clipheight' => $restricted
        ));
        $wide_data_copy = ImageTransform::getImageData($wide);
        $it = new ImageTransform($t->getArgs(), $wide_data_copy, $t->getGenericEntryFromListingHead());
        $it->applyFilter();
        $this->assertEquals($it->getOutputWidth() == $restricted, true);
        $this->assertEquals($it->getOutputHeight() == $restricted, true);
        // test expanding using clipping functions [not really supported]
        $t->setArgsByArray(array(
            'clipwidth' => $restricted,
            'clipheight' => 2 * $long
        ));
        $data_copy = ImageTransform::getImageData($wide);
        $it = new ImageTransform($t->getArgs(), $data_copy, $t->getGenericEntryFromListingHead());
        $it->applyFilter();
        $this->assertEquals($it->getOutputWidth() == $restricted, true);
        $this->assertEquals($it->getOutputHeight() == 2 * $long, true);
        // test height-bound landscape resize using shortest, followed by a clip
        $t->setArgsByArray(array(
            'maxshortest' => $restricted,
            'clipwidth' => $restricted,
            'clipheight' => $restricted
        ));
        $data_copy = ImageTransform::getImageData($tall);
        $it = new ImageTransform($t->getArgs(), $data_copy, $t->getGenericEntryFromListingHead());
        $it->applyFilter();
        $this->assertEquals($it->getOutputWidth() == $restricted, true);
        $this->assertEquals($it->getOutputHeight() == $restricted, true);
        // clean up images
        imagedestroy($wide);
        imagedestroy($tall);
    }

    public function testTakeSnapshot()
    {
        $t = new ImageviewController();
        // skip test if we can't reach ffmpeg

        // prime the controller with the video URL, generate thumbnail at 00:00:10.0
        $frame10s = $t->imageAction(
            'structured/tests/data/40-video_folder/nasa-solar-flare-64x64.m4v',
            'full', 'full', 0, 'native', 'jpg',
            false, new Request());
        $leaf = 'test-nasa-solar-flare-64x64-t000900.dat';
        // create an MFR to get cache directory path
        $localmfr = new CachedMetadataFileReader(null, $t);
        // take snapshot at 00:00:09.0
        $outputname = $t->takeSnapshot('00:00:09.0', $localmfr->getFilename($leaf));
        if ($outputname) {
            // read the snapshot from 00:00:09.0
            $frame9s = file_get_contents($outputname);
            $this->assertNotEquals($frame10s, $frame9s);
            // check that both snapshots are not the error image
            $rawerrorimg = $t->loadErrorImage();
            $it = new ImageTransform($t->getArgs(), $rawerrorimg, $t->getGenericEntryFromListingHead());
            $it->applyFilter();
            $errorimg = $it->getImgdata();
            $this->assertNotEquals($frame10s, $errorimg);
            $this->assertNotEquals($frame9s, $errorimg);
        } else {
            print("\r\n" . 'testTakeSnapshot skipped because ffmpeg is not installed/configured' . "\r\n");
        }
    }

    public function testPlatformImageLimits()
    {
        // expand memory limit for tests
        ini_set('memory_limit', '140M');
        // progressively test larger images
        // 1MP
        $this->assertNotEquals($img = imagecreatetruecolor(1 * 1000, 1 * 1000), null);
        imagedestroy($img);
        // 4MP
        $this->assertNotEquals($img = imagecreatetruecolor(2 * 1000, 2 * 1000), null);
        imagedestroy($img);
        // 16MP
        $this->assertNotEquals($img = imagecreatetruecolor(4 * 1000, 4 * 1000), null);
        imagedestroy($img);
        // 24MP
        $this->assertNotEquals($img = imagecreatetruecolor(4.9 * 1000, 4.9 * 1000), null); // limit of PHP @ 128M
        imagedestroy($img);
        if (intval(ini_get('memory_limit')) <= 140) return;
        // 25MP
        $this->assertNotEquals($img = imagecreatetruecolor(5 * 1000, 5 * 1000), null);
        imagedestroy($img);
        // 36MP
        $this->assertNotEquals($img = imagecreatetruecolor(6 * 1000, 6 * 1000), null);
        imagedestroy($img);
        // 49MP
        $this->assertNotEquals($img = imagecreatetruecolor(7 * 1000, 7 * 1000), null);
        imagedestroy($img);
        // 50.4MP
        $this->assertNotEquals($img = imagecreatetruecolor(7.1 * 1000, 7.1 * 1000), null); // limit of PHP @ 256M
        imagedestroy($img);
        if (intval(ini_get('memory_limit')) <= 256) return;
        // 64MP
        $this->assertNotEquals($img = imagecreatetruecolor(8 * 1000, 8 * 1000), null);
        imagedestroy($img);
        // 100MP
        $this->assertNotEquals($img = imagecreatetruecolor(10 * 1000, 10 * 1000), null);
        imagedestroy($img);
        // 101.4MP
        $this->assertNotEquals($img = imagecreatetruecolor(10.07 * 1000, 10.07 * 1000), null); // limit of PHP @ 512M
        imagedestroy($img);
        if (intval(ini_get('memory_limit')) <= 512) return;
        // 121MP
        $this->assertNotEquals($img = imagecreatetruecolor(16 * 1000, 16 * 1000), null);
        imagedestroy($img);
    }

    public function testFailureCases()
    {
        // test attempt to open a massive image
        $t = new ImageviewController();
        // prime the controller with the image's URL
        // @todo this line is incredibly slow, don't know why
        $img = $t->imageAction('structured/tests/data/50-fail_image_folder/[1]',
            'full', 'full', 0, 'native', 'jpg',
            false, new Request());
        // load error image at same size (using $t's args from first call) and compare to massive image (error response)
        $rawerrorimg = $t->loadErrorImage();
        $it = new ImageTransform($t->getArgs(), $rawerrorimg, $t->getGenericEntryFromListingHead());
        $it->applyFilter();
        $errorimg = $it->getImgdata();
        $this->assertEquals($img, $errorimg);
        // load a normal (smaller) image and check that it's not an error
        $img = imagecreatefromstring($t->imageAction('structured/tests/data/20-image_folder/[i1]',
            'full', 'full', 0, 'native', 'jpg',
            false, new Request()));
        $this->assertNotEquals($img, $errorimg);
    }

    public function testImageFromTestshare()
    {
        $t = new ImageviewController();
        // load image via testshare (required controller)
        $imgdata = $t->imageAction('structured/testshare/30-zip_folder.zip/nested/00980006.JPG',
            'full', 'full', 0, 'native', 'jpg',
            false, new Request());
        // load the same image from a direct path for comparison
        $mfr = new MetadataFileReader($t->convertRawToFilename('/structured/tests/data/30-zip_folder.zip/nested/00980006.JPG'), $t);
        $this->assertEquals($mfr->isExisting(), true);
        // compare images by dimensions; can't do direct comparison because cached file has its own metadata
        $diff = array_diff(getimagesizefromstring($imgdata), getimagesizefromstring($mfr->get()));
        $this->assertEquals(0, count($diff));
    }

    //
    // HELPERS
    //

    private function fireRequestForContent($url, $file_cache = null)
    {
        // scrub existing cache entry for this route
        if (($file_cache !== null) && file_exists($file_cache)) {
            unlink($file_cache);
        }
        // fire a simple request for test URL
        $this->client->followRedirects();
        $crawler = $this->client->request('GET', $url);
        // check the returned content for some basic known HTML
        $content = $this->client->getResponse()->getContent();
        return $content;
    }


}
