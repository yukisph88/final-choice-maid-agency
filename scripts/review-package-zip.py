"""Create an AES-256 password-protected zip of a folder.  usage: review-package-zip.py <folder> <out.zip>  (password in env ZIP_PASSWORD)"""
import os, sys
import pyzipper

folder, out = sys.argv[1], sys.argv[2]
pw = os.environ.get('ZIP_PASSWORD', '').encode()
if not pw:
    sys.exit('ZIP_PASSWORD is not set')
base = os.path.dirname(os.path.abspath(folder))
with pyzipper.AESZipFile(out, 'w', compression=pyzipper.ZIP_DEFLATED, encryption=pyzipper.WZ_AES) as z:
    z.setpassword(pw)
    z.setencryption(pyzipper.WZ_AES, nbits=256)
    for root, _, files in os.walk(folder):
        for f in sorted(files):
            p = os.path.join(root, f)
            z.write(p, os.path.relpath(p, base).replace(os.sep, '/'))
print('zip written:', out)
