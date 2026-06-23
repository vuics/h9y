'''
Selfdev Agency Setup
'''
import setuptools

setuptools.setup(
  name='selfdev-agency',
  version='1.0.0',
  author='Artem Arakcheev',
  author_email='artarakcheev@gmail.com',
  description='Selfdev Agency microservices',
  url='https://github.com/vuics/selfdev-agency.git',
  packages=setuptools.find_packages(),
  classifiers=[
    'Programming Language :: Python :: 3',
    'Operating System :: OS Independent',
  ],
  python_requires='>=3.10',
  install_requires=[
  ],
)
